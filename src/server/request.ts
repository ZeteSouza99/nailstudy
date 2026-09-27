import "server-only";

import { headers } from "next/headers";

/** IP de quem fez a requisição, como informado pela Vercel (primeiro item do x-forwarded-for). */
export async function getRequestIp() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}
