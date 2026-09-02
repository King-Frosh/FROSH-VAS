import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureDatabaseReady } from "@/db/init";
import { filterPresets } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  await ensureDatabaseReady();
  const rows = await db.select().from(filterPresets).orderBy(asc(filterPresets.name));
  return NextResponse.json({
    rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: unknown; config?: unknown };
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Preset name required" }, { status: 400 });
  const [row] = await db
    .insert(filterPresets)
    .values({ name: name.slice(0, 80), config: (body.config ?? {}) as never })
    .returning();
  return NextResponse.json({ row });
}
