import { CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Filtro de período por GET; recarrega a página com `?de=&ate=`. */
export function PeriodFilter({ from, to }: { from: string; to: string }) {
  return (
    <form
      method="get"
      className="surface-card grid grid-cols-1 items-end gap-3 min-[400px]:grid-cols-2 sm:flex sm:flex-wrap p-4"
      aria-label="Filtrar por período"
    >
      <div className="min-w-0">
        <label className="form-label" htmlFor="period-from">
          De
        </label>
        <input
          id="period-from"
          type="date"
          name="de"
          defaultValue={from}
          max={to}
          className="form-control"
        />
      </div>
      <div className="min-w-0">
        <label className="form-label" htmlFor="period-to">
          Até
        </label>
        <input id="period-to" type="date" name="ate" defaultValue={to} className="form-control" />
      </div>
      <Button type="submit" variant="secondary" className="min-[400px]:col-span-2 sm:w-auto">
        <CalendarRange className="size-4" aria-hidden="true" />
        Aplicar
      </Button>
    </form>
  );
}
