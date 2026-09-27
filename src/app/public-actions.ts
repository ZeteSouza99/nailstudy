"use server";

import {
  accessTokenSchema,
  availabilityQuerySchema,
  publicBookingSchema,
  recoveryRequestSchema,
  recoveryVerifySchema,
  rescheduleSchema,
} from "@/lib/validation";
import { refreshApp, runAction } from "@/server/action";
import {
  cancelPublicBooking,
  createPublicBooking,
  listAvailability,
  reschedulePublicBooking,
} from "@/server/booking-service";
import { parseInput } from "@/server/errors";
import { requestRecoveryCode, verifyRecoveryCode } from "@/server/recovery-service";
import { getRequestIp } from "@/server/request";

export async function listAvailabilityAction(input: unknown) {
  return runAction(async () =>
    listAvailability(parseInput(availabilityQuerySchema, input), { ip: await getRequestIp() }),
  );
}

export async function createPublicBookingAction(input: unknown) {
  return runAction(async () => {
    const confirmation = await createPublicBooking(parseInput(publicBookingSchema, input), {
      ip: await getRequestIp(),
    });
    refreshApp();
    return confirmation;
  });
}

export async function cancelPublicBookingAction(token: unknown) {
  return runAction(async () => {
    await cancelPublicBooking(parseInput(accessTokenSchema, token));
    refreshApp();
    return null;
  });
}

export async function reschedulePublicBookingAction(input: unknown) {
  return runAction(async () => {
    const confirmation = await reschedulePublicBooking(parseInput(rescheduleSchema, input));
    refreshApp();
    return confirmation;
  });
}

export async function requestRecoveryCodeAction(input: unknown) {
  return runAction(async () => {
    await requestRecoveryCode(parseInput(recoveryRequestSchema, input), {
      ip: await getRequestIp(),
    });
    return null;
  });
}

export async function verifyRecoveryCodeAction(input: unknown) {
  return runAction(async () => verifyRecoveryCode(parseInput(recoveryVerifySchema, input)));
}
