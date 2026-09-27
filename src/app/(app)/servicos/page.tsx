import type { Metadata } from "next";

import { ServicesView } from "@/components/services/services-view";
import { listServices } from "@/server/queries";
import { requirePageUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Serviços",
};

export default async function ServicesPage() {
  await requirePageUser();
  const services = await listServices();

  return <ServicesView services={services} canManage />;
}
