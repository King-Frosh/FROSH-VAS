import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ensureDatabaseReady } from "@/db/init";
import { reportSettings } from "@/db/schema";
import { previousNigeriaDate, sendPartnerReport } from "@/lib/report-email";

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDatabaseReady();
  const reportDate = previousNigeriaDate();
  const settings = await db.select().from(reportSettings).where(eq(reportSettings.enabled, true));
  const results: unknown[] = [];

  for (const setting of settings) {
    try {
      results.push({ partner: setting.partnerName, ...(await sendPartnerReport(setting, reportDate)) });
    } catch (error) {
      results.push({
        partner: setting.partnerName,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({ ok: true, reportDate, results });
}
