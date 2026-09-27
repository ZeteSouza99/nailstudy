import type { Metadata } from "next";

import { BlocksView } from "@/components/blocks/blocks-view";
import { getTodayKey } from "@/lib/date";
import { can } from "@/lib/permissions";
import { listProfessionals, listUpcomingBlocks } from "@/server/queries";
import { requirePageUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Bloqueios de agenda",
};

export default async function BlocksPage() {
  const user = await requirePageUser("blocks:view");
  const today = getTodayKey();
  const [blocks, professionals] = await Promise.all([
    listUpcomingBlocks(today),
    listProfessionals(),
  ]);

  return (
    <BlocksView
      blocks={blocks}
      professionals={professionals}
      today={today}
      canManage={can(user.role, "blocks:manage")}
    />
  );
}
