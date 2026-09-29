"use client";

import { groupSlotsByTime } from "@/lib/booking";
import { cn } from "@/lib/formatters";

export interface SlotOption {
  startTime: string;
  professionalId: string;
  professionalName: string;
}

interface SlotPickerProps {
  id: string;
  date: string;
  minDate: string;
  maxDate: string;
  slots: SlotOption[];
  isLoading: boolean;
  selected: SlotOption | null;
  onDateChange: (date: string) => void;
  onSelect: (slot: SlotOption) => void;
}

/** Data + horários livres agrupados; usado ao agendar e ao remarcar. */
export function SlotPicker({
  id,
  date,
  minDate,
  maxDate,
  slots,
  isLoading,
  selected,
  onDateChange,
  onSelect,
}: SlotPickerProps) {
  const grouped = groupSlotsByTime(slots);

  return (
    <div>
      <label className="form-label mt-3 block" htmlFor={id}>
        Data
      </label>
      <input
        id={id}
        type="date"
        className="form-control"
        value={date}
        min={minDate}
        max={maxDate}
        onChange={(event) => onDateChange(event.target.value)}
      />

      <div className="mt-4" aria-live="polite">
        {isLoading ? (
          <p className="text-sm text-ink-500 dark:text-ink-400">Buscando horários disponíveis…</p>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-ink-600 dark:text-ink-300">Nenhum horário livre nesta data. Tente outro dia.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="group" aria-label="Horários disponíveis">
            {grouped.map(({ startTime, options }) => {
              const isSelected = selected?.startTime === startTime;
              return (
                <button
                  key={startTime}
                  type="button"
                  onClick={() => onSelect(options[0])}
                  aria-pressed={isSelected}
                  className={cn(
                    "min-h-11 rounded-lg border px-2 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600",
                    isSelected
                      ? "border-brand-600 bg-brand-700 text-white"
                      : "border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-200 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950",
                  )}
                >
                  {startTime}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected ? (
        <p className="mt-3 text-xs text-ink-600 dark:text-ink-300">
          Atendimento com{" "}
          <strong className="font-semibold text-ink-900 dark:text-ink-50">{selected.professionalName}</strong>.
        </p>
      ) : null}
    </div>
  );
}
