import { Search, X } from "lucide-react";
import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/formatters";

interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  onClear?: () => void;
}

export function SearchInput({
  className,
  value,
  onClear,
  ...props
}: SearchInputProps) {
  const hasValue = typeof value === "string" && value.length > 0;

  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
      />
      <input
        type="search"
        value={value}
        className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-9 text-sm text-slate-900 dark:text-slate-50 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-3 focus:ring-teal-100 dark:focus:ring-teal-900"
        {...props}
      />
      {hasValue && onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          aria-label="Limpar busca"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
