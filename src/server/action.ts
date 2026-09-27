import "server-only";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import type { ActionResult } from "@/lib/action-result";

import { toUserMessage } from "./errors";

/**
 * Converte falhas em resultado. O Next mascara mensagens de exceções de
 * Server Actions em produção, então o erro legível precisa voltar como dado.
 */
export async function runAction<T>(
  operation: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    unstable_rethrow(error);
    const { message, fieldErrors } = toUserMessage(error);
    return { ok: false, error: message, fieldErrors };
  }
}

/** As páginas são dinâmicas; isto só invalida o cache do roteador de quem fez a ação. */
export function refreshApp() {
  revalidatePath("/", "layout");
}
