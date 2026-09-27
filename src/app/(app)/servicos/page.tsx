import type { Metadata } from "next";

import { ServicesView } from "@/components/services/services-view";
import { can } from "@/lib/permissions";
import { listServices } from "@/server/queries";
import { requirePageUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Serviços",
};

export default async function ServicesPage() {
  const user = await requirePageUser("catalog:view");
  const services = await listServices();

  return <ServicesView services={services} canManage={can(user.role, "catalog:manage")} />;
}
