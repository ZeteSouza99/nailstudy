import type { Metadata } from "next";
import { ProfessionalsView } from "@/components/professionals/professionals-view";
import { listProfessionals } from "@/server/queries";
import { requirePageUser } from "@/server/session";

export const metadata: Metadata = { title: "Meu estúdio" };

export default async function ProfessionalsPage() {
  await requirePageUser();
  const [professional] = await listProfessionals();
  if (!professional) throw new Error("Cadastro do estúdio não encontrado. Aplique as migrations.");
  return <ProfessionalsView professional={professional} />;
}
