import { ArrowLeft, CalendarX2 } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 dark:bg-ink-950 px-4">
      <div className="max-w-md text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
          <CalendarX2 className="size-7" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.15em] text-brand-700 dark:text-brand-300">
          Erro 404
        </p>
        <h1 className="mt-2 text-2xl font-extrabold text-ink-950 dark:text-ink-50">
          Página não encontrada
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-500 dark:text-ink-400">
          O endereço acessado não existe ou pode ter sido alterado.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-900"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar à visão geral
        </Link>
      </div>
    </div>
  );
}
