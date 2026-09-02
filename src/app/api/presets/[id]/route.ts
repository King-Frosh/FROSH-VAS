import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureDatabaseReady } from "@/db/init";
import { filterPresets } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDatabaseReady();
  const { id } = await params;
  await db.delete(filterPresets).where(eq(filterPresets.id, Number(id)));
  return NextResponse.json({ ok: true });
}
