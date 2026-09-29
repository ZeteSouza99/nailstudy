import "server-only";

import bcrypt from "bcryptjs";
import { eq, or, sql } from "drizzle-orm";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { db } from "@/db";
import { users } from "@/db/schema";
import { UserError } from "@/server/errors";
import { enforceRateLimit, rateLimits, resetRateLimits } from "@/server/rate-limit";

import { authConfig } from "./auth.config";

/** Hash de uma senha descartada, com o mesmo custo das reais, para o tempo de resposta não revelar e-mails. */
const DUMMY_HASH = "$2b$12$MEcCf1ld7MbBo39ms2d9feWtADH3itPG2ErVVEZmkedbzSskHuRCi";

class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Usuário", type: "text" },
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials, request) {
        const identifier = String(credentials?.username ?? credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");

        if (!identifier || identifier.length > 254 || !password) {
          return null;
        }

        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

        const ipRateKey = `login:ip:${ip}`;
        const accountRateKey = `login:account:${identifier}`;

        try {
          await enforceRateLimit(ipRateKey, rateLimits.loginIp);
          await enforceRateLimit(accountRateKey, rateLimits.loginEmail);
        } catch (error) {
          if (error instanceof UserError) throw new RateLimitedSignin();
          throw error;
        }

        const [user] = await db
          .select()
          .from(users)
          .where(or(sql`lower(${users.username}) = ${identifier}`, eq(users.email, identifier)))
          .limit(1);

        const matches = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

        if (!user || !matches) {
          return null;
        }

        await resetRateLimits([ipRateKey, accountRateKey]);
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
});
