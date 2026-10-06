import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ensureDatabaseReady } from "@/db/init";
import { reportSettings } from "@/db/schema";
import { previousNigeriaDate, sendPartnerReport } from "@/lib/report-email";

export async function POST(req: Request) {
  await ensureDatabaseReady();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const partnerName = String(body.partnerName ?? "").trim();
  const reportDate = String(body.reportDate ?? previousNigeriaDate());

  if (!partnerName) return NextResponse.json({ error: "Partner is required." }, { status: 400 });

  const [setting] = await db.select().from(reportSettings).where(eq(reportSettings.partnerName, partnerName)).limit(1);
  if (!setting) return NextResponse.json({ error: "Save the partner email configuration first." }, { status: 404 });

  try {
    const result = await sendPartnerReport(setting, reportDate, { force: true });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
