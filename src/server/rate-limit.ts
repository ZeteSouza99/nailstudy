import "server-only";

import { inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { bookingRateLimits } from "@/db/schema";

import { UserError } from "./errors";

export interface RateLimitRule {
  limit: number;
  windowMinutes: number;
}

export const rateLimits = {
  bookingPhone: { limit: 10, windowMinutes: 60 },
  bookingIp: { limit: 30, windowMinutes: 60 },
  availabilityIp: { limit: 300, windowMinutes: 60 },
  reschedule: { limit: 10, windowMinutes: 60 },
  recoveryPhone: { limit: 5, windowMinutes: 60 },
  recoveryIp: { limit: 20, windowMinutes: 60 },
  loginEmail: { limit: 10, windowMinutes: 15 },
  loginIp: { limit: 50, windowMinutes: 15 },
} satisfies Record<string, RateLimitRule>;

/**
 * Conta a tentativa e rejeita acima do teto. É um único upsert, então
 * requisições simultâneas não escapam do limite.
 */
export async function enforceRateLimit(key: string, rule: RateLimitRule) {
  const windowExpired = sql`${bookingRateLimits.windowStart} < now() - make_interval(mins => ${rule.windowMinutes})`;

  const [row] = await db
    .insert(bookingRateLimits)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: bookingRateLimits.key,
      set: {
        count: sql`case when ${windowExpired} then 1 else ${bookingRateLimits.count} + 1 end`,
        windowStart: sql`case when ${windowExpired} then now() else ${bookingRateLimits.windowStart} end`,
      },
    })
    .returning({ count: bookingRateLimits.count });

  if ((row?.count ?? 0) > rule.limit) {
    throw new UserError(
      "Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.",
    );
  }
}

/** Uma autenticação válida encerra a janela de falhas da conta e do IP. */
export async function resetRateLimits(keys: string[]) {
  if (keys.length === 0) return;
  await db.delete(bookingRateLimits).where(inArray(bookingRateLimits.key, keys));
}
