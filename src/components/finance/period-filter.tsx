import { CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Filtro de período por GET; recarrega a página com `?de=&ate=`. */
export function PeriodFilter({ from, to }: { from: string; to: string }) {
  return (
    <form
      method="get"
      className="surface-card flex flex-wrap items-end gap-3 p-4"
      aria-label="Filtrar por período"
    >
      <div>
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
      <div>
        <label className="form-label" htmlFor="period-to">
          Até
        </label>
        <input id="period-to" type="date" name="ate" defaultValue={to} className="form-control" />
      </div>
      <Button type="submit" variant="secondary">
        <CalendarRange className="size-4" aria-hidden="true" />
        Aplicar
      </Button>
    </form>
  );
}
