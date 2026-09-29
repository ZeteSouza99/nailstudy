import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

/** Rotas sem sessão da equipe: portal da cliente, login, Auth.js e cron (com segredo próprio). */
const publicPrefixes = ["/agendar", "/meu-agendamento", "/login", "/api/auth", "/api/cron"];

function isPublic(pathname: string) {
  // O sistema operacional deve atualizar o worker e ler o manifest mesmo sem sessão.
  if (pathname === "/sw.js" || pathname === "/manifest.webmanifest") return true;
  return publicPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default auth((req) => {
  const { pathname, search } = req.nextUrl;

  if (isPublic(pathname) || req.auth) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.nextUrl);
  loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
