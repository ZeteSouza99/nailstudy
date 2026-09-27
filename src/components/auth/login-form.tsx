"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { safeCallbackUrl } from "@/lib/safe-redirect";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);

    try {
      const result = await signIn("credentials", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirect: false,
      });

      if (result?.error) {
        setError(
          result.code === "rate_limited"
            ? "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente."
            : "E-mail ou senha inválidos.",
        );
        return;
      }

      router.push(safeCallbackUrl(searchParams.get("callbackUrl")));
      router.refresh();
    } catch {
      setError("Erro ao entrar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
      {error ? <Alert>{error}</Alert> : null}

      <div>
        <label className="form-label" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="form-control"
          required
          autoComplete="email"
          placeholder="voce@nailagenda.com"
        />
      </div>

      <div>
        <label className="form-label" htmlFor="password">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="form-control"
          required
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </div>

      <Button type="submit" className="w-full" loading={isLoading}>
        {isLoading ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
