import { ArrowLeft, CalendarX2 } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="max-w-md text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
          <CalendarX2 className="size-7" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.15em] text-teal-700 dark:text-teal-300">
          Erro 404
        </p>
        <h1 className="mt-2 text-2xl font-extrabold text-slate-950 dark:text-slate-50">
          Página não encontrada
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          O endereço acessado não existe ou pode ter sido alterado.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar à visão geral
        </Link>
      </div>
    </div>
  );
}
