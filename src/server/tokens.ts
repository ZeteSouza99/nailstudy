import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function tokenSecret() {
  const secret = process.env.TOKEN_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("Defina TOKEN_SECRET ou AUTH_SECRET para gerar links de agendamento.");
  }
  return secret;
}

export function hasTokenSecret() {
  return Boolean(process.env.TOKEN_SECRET ?? process.env.AUTH_SECRET);
}

/**
 * O link da cliente é derivado do id com HMAC: dá para reenviá-lo (lembretes,
 * recuperação) sem guardar o token em texto puro no banco.
 */
export function createAccessToken(appointmentId: string) {
  return createHmac("sha256", tokenSecret())
    .update(`appointment:${appointmentId}`)
    .digest("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function accessTokenHashFor(appointmentId: string) {
  return hashToken(createAccessToken(appointmentId));
}

/** Hash com segredo para códigos curtos (OTP), que seriam triviais de quebrar só com SHA-256. */
export function hashVerificationCode(key: string, code: string) {
  return createHmac("sha256", tokenSecret()).update(`${key}:${code}`).digest("hex");
}

export function safeEqual(first: string, second: string) {
  const a = Buffer.from(first);
  const b = Buffer.from(second);
  return a.length === b.length && timingSafeEqual(a, b);
}
