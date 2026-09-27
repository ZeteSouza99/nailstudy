import "server-only";

import { randomInt } from "node:crypto";

import { and, asc, eq, gt, gte, inArray, sql } from "drizzle-orm";
import type { z } from "zod";

import { db } from "@/db";
import { appointments, clients, verificationCodes } from "@/db/schema";
import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/booking";
import { getTodayKey, normalizeTime } from "@/lib/date";
import { normalizePhone } from "@/lib/phone";
import type { recoveryRequestSchema, recoveryVerifySchema } from "@/lib/validation";
import type { AppointmentStatus } from "@/types/domain";

import { ensureAccessTokens } from "./access-links";
import { UserError } from "./errors";
import { appointmentPath, messages } from "./messages";
import { sendNotification } from "./notifications";
import { enforceRateLimit, rateLimits } from "./rate-limit";
import { hashVerificationCode, safeEqual } from "./tokens";

const CODE_TTL_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;

type RecoveryRequest = z.infer<typeof recoveryRequestSchema>;
type RecoveryVerify = z.infer<typeof recoveryVerifySchema>;

export interface RecoveredAppointment {
  path: string;
  date: string;
  startTime: string;
  serviceName: string;
  professionalName: string;
  status: AppointmentStatus;
}

function recoveryKey(phoneDigits: string) {
  return `recovery:${phoneDigits}`;
}

async function findClientWithUpcoming(phoneDigits: string) {
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.phoneDigits, phoneDigits))
    .limit(1);
  if (!client) return null;

  const rows = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.clientId, client.id),
        gte(appointments.date, getTodayKey()),
        inArray(appointments.status, [...ACTIVE_APPOINTMENT_STATUSES]),
      ),
    )
    .orderBy(asc(appointments.date), asc(appointments.startTime));

  return { clientId: client.id, appointments: rows };
}

/**
 * Sempre responde do mesmo jeito, exista ou não a cliente, para o portal
 * não revelar quem tem cadastro.
 */
export async function requestRecoveryCode(input: RecoveryRequest, { ip }: { ip: string }) {
  const phoneDigits = normalizePhone(input.phone);
  await enforceRateLimit(`recovery:ip:${ip}`, rateLimits.recoveryIp);
  await enforceRateLimit(`recovery:phone:${phoneDigits}`, rateLimits.recoveryPhone);

  const found = await findClientWithUpcoming(phoneDigits);
  if (!found?.appointments.length) return;

  const key = recoveryKey(phoneDigits);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const values = {
    codeHash: hashVerificationCode(key, code),
    attempts: 0,
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
    createdAt: new Date(),
  };

  await db
    .insert(verificationCodes)
    .values({ key, ...values })
    .onConflictDoUpdate({ target: verificationCodes.key, set: values });

  sendNotification({ kind: "recovery-code", to: phoneDigits, text: messages.recoveryCode(code) });
}

export async function verifyRecoveryCode(input: RecoveryVerify): Promise<RecoveredAppointment[]> {
  const phoneDigits = normalizePhone(input.phone);
  const key = recoveryKey(phoneDigits);
  const invalid = new UserError("Código inválido ou expirado. Peça um novo código.", {
    code: "Código inválido ou expirado.",
  });

  // A tentativa é contada antes de comparar, num único update.
  const [row] = await db
    .update(verificationCodes)
    .set({ attempts: sql`${verificationCodes.attempts} + 1` })
    .where(and(eq(verificationCodes.key, key), gt(verificationCodes.expiresAt, new Date())))
    .returning({ codeHash: verificationCodes.codeHash, attempts: verificationCodes.attempts });

  if (!row || row.attempts > MAX_CODE_ATTEMPTS) throw invalid;
  if (!safeEqual(row.codeHash, hashVerificationCode(key, input.code))) throw invalid;

  await db.delete(verificationCodes).where(eq(verificationCodes.key, key));

  const found = await findClientWithUpcoming(phoneDigits);
  if (!found) return [];

  const tokens = await ensureAccessTokens(found.appointments);

  return found.appointments.map((appointment) => ({
    path: appointmentPath(tokens.get(appointment.id) as string),
    date: appointment.date,
    startTime: normalizeTime(appointment.startTime),
    serviceName: appointment.serviceName,
    professionalName: appointment.professionalName,
    status: appointment.status,
  }));
}
