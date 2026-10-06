import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { ensureDatabaseReady } from "@/db/init";
import { reportDeliveryLogs } from "@/db/schema";

export async function GET() {
  await ensureDatabaseReady();
  const rows = await db.select().from(reportDeliveryLogs).orderBy(desc(reportDeliveryLogs.createdAt)).limit(100);
  return NextResponse.json({ rows });
}
