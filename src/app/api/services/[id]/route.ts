import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureDatabaseReady } from "@/db/init";
import { services } from "@/db/schema";
import { eq } from "drizzle-orm";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  await ensureDatabaseReady();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: unknown;
    revSharePct?: unknown;
    status?: unknown;
  };
  const patch: Partial<typeof services.$inferInsert> = {};
  if (typeof body.name === "string") patch.name = body.name.slice(0, 120);
  if (typeof body.revSharePct === "number" && body.revSharePct >= 0 && body.revSharePct <= 100) {
    patch.revSharePct = String(Math.round(body.revSharePct * 100) / 100);
  }
  if (body.status === "active" || body.status === "inactive") patch.status = body.status;
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  const [row] = await db
    .update(services)
    .set(patch)
    .where(eq(services.id, Number(id)))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ row });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await db.delete(services).where(eq(services.id, Number(id)));
  return NextResponse.json({ ok: true });
}
