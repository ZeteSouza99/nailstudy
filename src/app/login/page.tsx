import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Entrar",
};

export default async function LoginPage() {
  // Checado aqui, e não no proxy, para uma sessão de usuário removido não criar loop de redirecionamento.
  if (await getCurrentUser()) {
    redirect("/");
  }

  return (
    <div className="login-background relative flex min-h-dvh items-center justify-center bg-ink-50 px-5 pb-8 pt-16 md:py-20 dark:bg-ink-950 sm:px-8">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="grid w-full max-w-4xl items-center gap-5 md:gap-8 md:grid-cols-[1.15fr_1fr] md:gap-14">
        <div className="text-center">
          <div className="mx-auto max-w-[220px] sm:max-w-[290px] overflow-hidden rounded-[2rem] border border-gold-400/40 shadow-[0_24px_70px_-30px_#83423e80] md:max-w-none">
            <Image
              src="/erika-nails.png"
              alt="Erika Queiroz Nail Designer — logo em rosé dourado"
              width={1466}
              height={1073}
              sizes="(max-width: 639px) 220px, (max-width: 767px) 290px, 440px"
              preload
              className="h-auto w-full"
            />
          </div>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-700 dark:text-brand-300">
            Beleza e cuidado em cada detalhe
          </p>
        </div>
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-5 text-center md:mb-7 md:text-left">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Seu espaço de gestão</p>
            <h1 className="font-serif text-3xl sm:text-4xl tracking-tight text-ink-900 dark:text-gold-200">Bem-vinda, Erika</h1>
            <p className="mt-3 text-sm leading-6 text-ink-600 dark:text-ink-300">Entre para cuidar da sua agenda, das suas clientes e do seu estúdio.</p>
          </div>
          <Suspense
            fallback={
              <div className="h-72 animate-pulse rounded-2xl border border-ink-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-900" />
            }
          >
            <LoginForm />
          </Suspense>
          <p className="mt-6 text-center text-[11px] text-ink-500 dark:text-ink-400">Erika Queiroz · Nail Designer</p>
        </div>
      </div>
    </div>
  );
}
