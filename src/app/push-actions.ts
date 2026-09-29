"use server";

import { pushEndpointSchema, pushSubscriptionSchema } from "@/lib/push-validation";
import { runAction } from "@/server/action";
import { getPushPublicKey, removePushSubscription, savePushSubscription, sendTestPush } from "@/server/admin-push";
import { parseInput } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { requireActionUser } from "@/server/session";

export async function getPushConfigurationAction() {
  return runAction(async () => {
    await requireActionUser();
    return { publicKey: getPushPublicKey() };
  });
}

export async function subscribeAdminPushAction(input: unknown) {
  return runAction(async () => {
    const user = await requireActionUser();
    await savePushSubscription(user.id, parseInput(pushSubscriptionSchema, input));
    return null;
  });
}

export async function unsubscribeAdminPushAction(endpoint: unknown) {
  return runAction(async () => {
    const user = await requireActionUser();
    await removePushSubscription(user.id, parseInput(pushEndpointSchema, endpoint));
    return null;
  });
}

export async function testAdminPushAction(endpoint: unknown) {
  return runAction(async () => {
    const user = await requireActionUser();
    const parsed = parseInput(pushEndpointSchema, endpoint);
    await enforceRateLimit(`push-test:${user.id}`, { limit: 10, windowMinutes: 15 });
    await sendTestPush(user.id, parsed);
    return null;
  });
}
