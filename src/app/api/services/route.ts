import { NextResponse } from "next/server";
import { db } from "@/db";
import { services, transactions } from "@/db/schema";
import { ensureRegistry, groupOf } from "@/db/registry";
import { asc, desc, eq, ilike, sql } from "drizzle-orm";

export async function GET(req: Request) {
  await ensureRegistry();
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const group = sp.get("group") ?? "";
  const status = sp.get("status") ?? "";
  const lite = sp.get("lite") === "1";
  const withStats = sp.get("stats") === "1";

  if (lite) {
    const rows = await db
      .select({
        serviceId: services.serviceId,
        name: services.name,
        groupCode: services.groupCode,
        status: services.status,
      })
      .from(services)
      .orderBy(asc(services.serviceId));
    return NextResponse.json({ rows });
  }

  const stats = db
    .select({
      serviceId: transactions.serviceId,
      txns: sql<number>`coalesce(sum(${transactions.txnCount}), 0)::int`.as("txns"),
      gross: sql<number>`coalesce(sum(${transactions.revenue}::numeric), 0)`.as("gross"),
      net: sql<number>`coalesce(sum(${transactions.netRevenue}::numeric), 0)`.as("net"),
      lastAt: sql<string>`max(${transactions.transactionAt})`.as("last_at"),
    })
    .from(transactions)
    .groupBy(transactions.serviceId)
    .as("stats");

  const conds = [];
  if (q) conds.push(ilike(services.serviceId, `%${q}%`));
  if (group) conds.push(eq(services.groupCode, group));
  if (status) conds.push(eq(services.status, status));

  const rows = await db
    .select({
      id: services.id,
      serviceId: services.serviceId,
      name: services.name,
      groupCode: services.groupCode,
      revSharePct: services.revSharePct,
      status: services.status,
      txns: withStats ? sql<number>`coalesce(${stats.txns}, 0)::int`.mapWith(Number) : sql<number>`0`.mapWith(Number),
      gross: withStats ? sql<number>`coalesce(${stats.gross}, 0)`.mapWith(Number) : sql<number>`0`.mapWith(Number),
      net: withStats ? sql<number>`coalesce(${stats.net}, 0)`.mapWith(Number) : sql<number>`0`.mapWith(Number),
      lastAt: withStats ? stats.lastAt : sql<string>`null`,
    })
    .from(services)
    .leftJoin(stats, eq(stats.serviceId, services.serviceId))
    .where(conds.length ? sql`${sql.join(conds, sql` and `)}` : undefined)
    .orderBy(desc(sql`coalesce(${stats.gross}, 0)`), asc(services.serviceId))
    .limit(500);

  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  await ensureRegistry();
  const body = (await req.json().catch(() => ({}))) as {
    serviceIds?: unknown;
    revSharePct?: unknown;
    status?: unknown;
  };
  const raw = Array.isArray(body.serviceIds) ? body.serviceIds : [];
  const ids = Array.from(
    new Set(
      raw
        .map((s) => String(s ?? "").replace(/\s+/g, "").trim())
        .filter((s) => /^\d{6,}$/.test(s)),
    ),
  );
  if (!ids.length) {
    return NextResponse.json({ error: "No valid service IDs supplied" }, { status: 400 });
  }
  const share =
    typeof body.revSharePct === "number" && body.revSharePct >= 0 && body.revSharePct <= 100
      ? String(body.revSharePct)
      : "70";
  const status = body.status === "inactive" ? "inactive" : "active";
  const res = await db
    .insert(services)
    .values(
      ids.map((sid) => ({
        serviceId: sid,
        groupCode: groupOf(sid),
        name: "",
        revSharePct: share,
        status,
      })),
    )
    .onConflictDoNothing({ target: services.serviceId })
    .returning({ id: services.id });
  return NextResponse.json({ added: res.length, attempted: ids.length });
}
