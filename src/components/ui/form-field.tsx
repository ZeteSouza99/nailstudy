import type { ReactNode } from "react";

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}

/** Rótulo, dica e erro do campo, ligados por id para leitores de tela. */
export function FormField({ id, label, error, hint, optional, children }: FormFieldProps) {
  return (
    <div>
      <label className="form-label" htmlFor={id}>
        {label}
        {optional ? <span className="font-normal text-slate-500 dark:text-slate-400"> (opcional)</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-[11px] font-medium text-rose-700 dark:text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Atributos de acessibilidade do controle conforme o estado de erro. */
export function fieldA11y(id: string, error?: string, hint?: string) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}
