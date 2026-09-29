"use client";

import { Check, Search, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { searchClientsAction } from "@/app/actions";
import type { ClientOption } from "@/server/queries";

interface ClientPickerProps {
  name: string;
  error?: string;
}

/** Busca clientes no servidor conforme a digitação, sem carregar a base inteira. */
export function ClientPicker({ name, error }: ClientPickerProps) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ClientOption[]>([]);
  const [selected, setSelected] = useState<ClientOption | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selected || !isOpen) return;

    let active = true;
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      const result = await searchClientsAction(query);
      if (!active) return;
      setOptions(result.ok ? result.data : []);
      setIsLoading(false);
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isOpen, query, selected]);

  const errorId = `${inputId}-error`;

  return (
    <div>
      <label className="form-label" htmlFor={inputId}>
        Cliente
      </label>
      <input type="hidden" name={name} value={selected?.id ?? ""} />

      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950 px-3 py-2">
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-900 dark:text-brand-200">
              <Check className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{selected.name}</span>
            </span>
            <span className="block text-xs text-brand-800 dark:text-brand-200">{selected.phone}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setQuery("");
              setIsOpen(true);
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-brand-800 dark:text-brand-200 hover:bg-brand-100 dark:hover:bg-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            <X className="size-3.5" aria-hidden="true" />
            Trocar
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
            aria-hidden="true"
          />
          <input
            id={inputId}
            type="search"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            autoComplete="off"
            className="form-control pl-9"
            placeholder="Nome, telefone ou e-mail"
            value={query}
            onFocus={() => setIsOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
          />
          {isOpen ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Clientes encontradas"
              className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-1 shadow-lg"
            >
              {isLoading ? (
                <li className="px-3 py-2 text-xs text-ink-500 dark:text-ink-400">Buscando…</li>
              ) : options.length === 0 ? (
                <li className="px-3 py-2 text-xs text-ink-500 dark:text-ink-400">
                  Nenhuma cliente encontrada. Cadastre em Clientes.
                </li>
              ) : (
                options.map((option) => (
                  <li key={option.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(option);
                        setIsOpen(false);
                      }}
                      className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-ink-50 dark:hover:bg-ink-950 focus-visible:bg-ink-50 dark:focus-visible:bg-ink-950 focus-visible:outline-none"
                    >
                      <span className="text-sm font-semibold text-ink-900 dark:text-ink-50">{option.name}</span>
                      <span className="text-xs text-ink-500 dark:text-ink-400">{option.phone}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      )}

      {error ? (
        <p id={errorId} className="mt-1 text-[11px] font-medium text-rose-700 dark:text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
