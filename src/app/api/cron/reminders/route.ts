import { NextResponse } from "next/server";

import { logger } from "@/server/logger";
import { sendDueReminders } from "@/server/reminder-service";
import { safeEqual } from "@/server/tokens";

export const dynamic = "force-dynamic";

/** Chamado pelo Vercel Cron, que envia `Authorization: Bearer <CRON_SECRET>`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  }

  if (!safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const result = await sendDueReminders();
  logger.info("reminders_run", result);
  return NextResponse.json(result);
}
