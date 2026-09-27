import "server-only";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { db } from "@/db";
import { users } from "@/db/schema";
import { UserError } from "@/server/errors";
import { enforceRateLimit, rateLimits } from "@/server/rate-limit";

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
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");

        if (!email || !password) {
          return null;
        }

        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

        try {
          await enforceRateLimit(`login:ip:${ip}`, rateLimits.loginIp);
          await enforceRateLimit(`login:email:${email}`, rateLimits.loginEmail);
        } catch (error) {
          if (error instanceof UserError) throw new RateLimitedSignin();
          throw error;
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        const matches = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

        if (!user || !matches) {
          return null;
        }

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
});
