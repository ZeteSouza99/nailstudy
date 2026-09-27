import type { Metadata } from "next";
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
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-20">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-950 dark:text-slate-50">Nail Agenda</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Gestão do seu estúdio de unhas</p>
        </div>
        <Suspense
          fallback={
            <div className="h-72 animate-pulse rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm" />
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
