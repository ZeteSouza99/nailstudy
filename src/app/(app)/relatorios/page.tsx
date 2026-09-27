import type { Metadata } from "next";

import { ReportsView } from "@/components/reports/reports-view";
import { getTodayKey } from "@/lib/date";
import { getFinancialReport } from "@/server/report-queries";
import { requirePageUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Relatórios",
};

interface ReportsPageProps {
  searchParams: Promise<{ de?: string; ate?: string }>;
}

const isDateKey = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  await requirePageUser("reports:view");
  const params = await searchParams;
  const today = getTodayKey();
  const monthStart = `${today.slice(0, 7)}-01`;
  const from = isDateKey(params.de) ? params.de : monthStart;
  const to = isDateKey(params.ate) && params.ate >= from ? params.ate : today;

  const report = await getFinancialReport(from, to);

  return <ReportsView report={report} />;
}
