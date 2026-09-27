import type { Metadata } from "next";

import { ClientsView } from "@/components/clients/clients-view";
import { getTodayKey } from "@/lib/date";
import { getClientStats, searchClients, type ClientSegment } from "@/server/queries";
import { requirePageUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Clientes",
};

const PAGE_SIZE = 20;
const segments: ClientSegment[] = ["todas", "com-agenda", "sem-agenda"];

interface ClientsPageProps {
  searchParams: Promise<{ q?: string; segmento?: string; pagina?: string; novo?: string }>;
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  await requirePageUser();
  const params = await searchParams;
  const today = getTodayKey();
  const query = typeof params.q === "string" ? params.q.slice(0, 80) : "";
  const segment = segments.find((item) => item === params.segmento) ?? "todas";
  const page = Math.max(1, Math.floor(Number(params.pagina)) || 1);

  const [result, stats] = await Promise.all([
    searchClients({ query, segment, page, pageSize: PAGE_SIZE, today }),
    getClientStats(today),
  ]);

  return (
    <ClientsView
      items={result.items}
      total={result.total}
      stats={stats}
      query={query}
      segment={segment}
      page={page}
      pageSize={PAGE_SIZE}
      today={today}
      canManage
      canDelete
      initiallyOpen={params.novo === "1"}
    />
  );
}
