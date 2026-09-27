import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/formatters";

type AlertTone = "error" | "success" | "info";

const toneClasses: Record<AlertTone, string> = {
  error: "border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-200",
  success: "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200",
  info: "border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950 text-sky-800 dark:text-sky-200",
};

const toneIcons = {
  error: CircleAlert,
  success: CheckCircle2,
  info: Info,
};

interface AlertProps {
  tone?: AlertTone;
  children: ReactNode;
  id?: string;
  className?: string;
  onDismiss?: () => void;
}

export function Alert({ tone = "error", children, id, className, onDismiss }: AlertProps) {
  const Icon = toneIcons[tone];

  return (
    <div
      id={id}
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium",
        toneClasses[tone],
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-0.5 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          aria-label="Dispensar aviso"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
