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
          <p className="text-sm text-slate-500 dark:text-slate-400">Buscando horários disponíveis…</p>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">Nenhum horário livre nesta data. Tente outro dia.</p>
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
                    "rounded-lg border px-2 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
                    isSelected
                      ? "border-teal-600 bg-teal-700 text-white"
                      : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-950",
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
        <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
          Atendimento com{" "}
          <strong className="font-semibold text-slate-900 dark:text-slate-50">{selected.professionalName}</strong>.
        </p>
      ) : null}
    </div>
  );
}
