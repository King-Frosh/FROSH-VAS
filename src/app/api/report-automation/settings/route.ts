import { NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureDatabaseReady } from "@/db/init";
import { reportSettings, transactions } from "@/db/schema";

export async function GET() {
  await ensureDatabaseReady();
  const partners = await db
    .select({
      partnerName: sql<string>`coalesce(nullif(${transactions.servicePartner}, ''), nullif(${transactions.network}, ''))`,
    })
    .from(transactions)
    .where(sql`coalesce(nullif(${transactions.servicePartner}, ''), nullif(${transactions.network}, '')) is not null`)
    .groupBy(sql`1`)
    .orderBy(asc(sql`1`));

  const settings = await db.select().from(reportSettings).orderBy(asc(reportSettings.partnerName));
  const configured = new Map(settings.map((s) => [s.partnerName, s]));

  return NextResponse.json({
    rows: partners.map((p) => ({
      ...(configured.get(p.partnerName) ?? { id: null, email: "", cc: "", enabled: false }),
      partnerName: p.partnerName,
    })),
  });
}

export async function POST(req: Request) {
  await ensureDatabaseReady();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const partnerName = String(body.partnerName ?? "").trim();
  const email = String(body.email ?? "").trim();
  const cc = String(body.cc ?? "").trim();
  const enabled = body.enabled === true;

  if (!partnerName || !email) {
    return NextResponse.json({ error: "Partner name and recipient email are required." }, { status: 400 });
  }

  const [row] = await db
    .insert(reportSettings)
    .values({ partnerName, email, cc, enabled })
    .onConflictDoUpdate({
      target: reportSettings.partnerName,
      set: { email, cc, enabled, updatedAt: new Date() },
    })
    .returning();

  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  await ensureDatabaseReady();
  const partnerName = new URL(req.url).searchParams.get("partner")?.trim();
  if (!partnerName) return NextResponse.json({ error: "Partner is required." }, { status: 400 });
  await db.delete(reportSettings).where(eq(reportSettings.partnerName, partnerName));
  return NextResponse.json({ ok: true });
}
