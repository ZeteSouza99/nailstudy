export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      <div className="h-9 w-64 animate-pulse rounded-xl bg-ink-200 dark:bg-ink-700" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900"
          />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900" />
    </div>
  );
}
