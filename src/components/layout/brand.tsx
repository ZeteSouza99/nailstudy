import { Sparkles } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white">
        <Sparkles className="size-4.5" aria-hidden="true" />
      </span>
      {!compact ? (
        <span>
          <span className="block text-[15px] font-bold leading-5 tracking-tight text-slate-900 dark:text-slate-50">
            Nail Agenda
          </span>
          <span className="block text-[11px] font-medium text-slate-400">
            Seu estúdio organizado
          </span>
        </span>
      ) : null}
    </div>
  );
}
