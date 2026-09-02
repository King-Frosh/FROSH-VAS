import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureDatabaseReady } from "@/db/init";
import { datasets } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  await ensureDatabaseReady();
  const rows = await db.select().from(datasets).orderBy(desc(datasets.createdAt)).limit(100);
  return NextResponse.json({
    rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  });
}
