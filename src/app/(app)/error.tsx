"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
          <TriangleAlert className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold text-slate-950 dark:text-slate-50">
          Algo deu errado
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Não foi possível carregar esta página. Tente novamente em instantes.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-[11px] text-slate-400">
            Código: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
