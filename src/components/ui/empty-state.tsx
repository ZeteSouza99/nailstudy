import { SearchX } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center px-6 py-12 text-center">
      <span className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400">
        <SearchX className="size-6" aria-hidden="true" />
      </span>
      <h3 className="font-semibold text-ink-900 dark:text-ink-50">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-ink-500 dark:text-ink-400">
        {description}
      </p>
    </div>
  );
}
