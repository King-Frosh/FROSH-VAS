import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureDatabaseReady } from "@/db/init";
import { datasets } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDatabaseReady();
  const { id } = await params;
  await db.delete(datasets).where(eq(datasets.id, Number(id)));
  return NextResponse.json({ ok: true });
}
