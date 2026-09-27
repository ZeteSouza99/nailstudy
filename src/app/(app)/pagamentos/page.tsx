import type { Metadata } from "next";

import { PaymentsView } from "@/components/payments/payments-view";
import { getTodayKey } from "@/lib/date";
import { can } from "@/lib/permissions";
import { listBillableAppointments, listPayments } from "@/server/payment-queries";
import { requirePageUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Pagamentos",
};

interface PaymentsPageProps {
  searchParams: Promise<{ de?: string; ate?: string; novo?: string }>;
}

const isDateKey = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const user = await requirePageUser("payments:view");
  const params = await searchParams;
  const today = getTodayKey();
  const monthStart = `${today.slice(0, 7)}-01`;
  const from = isDateKey(params.de) ? params.de : monthStart;
  const to = isDateKey(params.ate) ? params.ate : today;

  const [payments, billable] = await Promise.all([
    listPayments(from, to),
    listBillableAppointments(),
  ]);

  return (
    <PaymentsView
      payments={payments}
      billable={billable}
      from={from}
      to={to}
      today={today}
      canManage={can(user.role, "payments:manage")}
      openNew={params.novo === "1"}
    />
  );
}
