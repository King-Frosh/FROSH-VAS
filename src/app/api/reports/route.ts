import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureDatabaseReady } from "@/db/init";
import { services, transactions } from "@/db/schema";
import { AGG, AGG_EXTRA, buildWhere, parseServerFilters } from "@/lib/query";
import { eq, sql } from "drizzle-orm";

export async function GET(req: Request) {
  await ensureDatabaseReady();
  const sp = new URL(req.url).searchParams;
  const mode = sp.get("mode") ?? "summary";
  const f = parseServerFilters(sp);
  const where = buildWhere(f);

  if (mode === "summary") {
    const [row] = await db
      .select({ ...AGG, ...AGG_EXTRA })
      .from(transactions)
      .where(where);
    return NextResponse.json({
      gross: row?.gross ?? 0,
      net: row?.net ?? 0,
      operatorShare: (row?.gross ?? 0) - (row?.net ?? 0),
      txns: row?.txns ?? 0,
      success: row?.success ?? 0,
      failed: row?.failed ?? 0,
      pending: row?.pending ?? 0,
      refunded: row?.refunded ?? 0,
      services: row?.services ?? 0,
      subscribers: row?.subscribers ?? 0,
      days: row?.days ?? 0,
    });
  }

  if (mode === "timeseries") {
    const gran = sp.get("granularity") === "month" ? "month" : sp.get("granularity") === "week" ? "week" : "day";
    const rows = await db
      .select({
        bucket: sql<string>`date_trunc(${sql.raw(`'${gran}'`)}, ${transactions.transactionAt})`.as("bucket"),
        ...AGG,
      })
      .from(transactions)
      .where(where)
      .groupBy(sql`1`)
      .orderBy(sql`1`);
    const toIso = (b: unknown): string => {
      const d = b instanceof Date ? b : new Date(String(b).replace(" ", "T"));
      return d.toISOString();
    };
    return NextResponse.json({
      granularity: gran,
      rows: rows.map((r) => ({
        bucket: toIso(r.bucket),
        gross: r.gross,
        net: r.net,
        txns: r.txns,
        success: r.success,
        failed: r.failed,
      })),
    });
  }

  if (mode === "breakdown") {
    const dimension = sp.get("dimension") ?? "network";
    const limit = Math.min(50, parseInt(sp.get("limit") ?? "12", 10) || 12);
    const keyCol =
      dimension === "service"
        ? transactions.serviceId
        : dimension === "status"
          ? transactions.status
          : dimension === "group"
            ? transactions.groupCode
            : dimension === "product"
              ? sql<string>`coalesce(${transactions.productName}, ${transactions.productId}, 'Unknown')`
              : dimension === "transaction"
                ? sql<string>`coalesce(${transactions.transactionType}, 'Unknown')`
                : sql<string>`coalesce(${transactions.servicePartner}, ${transactions.network}, 'Unknown')`;
    const rows = await db
      .select({
        key: sql<string>`${keyCol}`.as("key"),
        ...AGG,
      })
      .from(transactions)
      .where(where)
      .groupBy(sql`1`)
      .orderBy(sql`${sql.raw("2")} desc`)
      .limit(limit);
    // attach registry names for service dimension
    let names = new Map<string, string>();
    if (dimension === "service") {
      const svc = await db.select({ serviceId: services.serviceId, name: services.name }).from(services);
      names = new Map(svc.map((s) => [s.serviceId, s.name]));
    }
    return NextResponse.json({
      dimension,
      rows: rows.map((r) => ({
        key: r.key,
        label: names.get(r.key) || r.key,
        gross: r.gross,
        net: r.net,
        txns: r.txns,
        success: r.success,
        failed: r.failed,
      })),
    });
  }

  // mode === "table"
  const type = sp.get("type") ?? "daily";
  const keyExpr =
    type === "monthly"
      ? sql<string>`to_char(date_trunc('month', ${transactions.transactionAt}), 'YYYY-MM')`
      : type === "daily"
        ? sql<string>`to_char(date_trunc('day', ${transactions.transactionAt}), 'YYYY-MM-DD')`
        : type === "service"
          ? sql<string>`${transactions.serviceId}`
          : type === "network" || type === "partner"
            ? sql<string>`coalesce(${transactions.servicePartner}, ${transactions.network}, 'Unknown')`
            : type === "product"
              ? sql<string>`coalesce(${transactions.productName}, ${transactions.productId}, 'Unknown')`
              : type === "transaction"
                ? sql<string>`coalesce(${transactions.transactionType}, 'Unknown')`
                : sql<string>`${transactions.status}`;

  const rows = await db
    .select({
      key: sql<string>`${keyExpr}`.as("key"),
      ...AGG,
    })
    .from(transactions)
    .where(where)
    .groupBy(sql`1`)
    .orderBy(type === "daily" || type === "monthly" ? sql`1 asc` : sql`${sql.raw("2")} desc`);

  let names = new Map<string, string>();
  if (type === "service") {
    const svc = await db
      .select({ serviceId: services.serviceId, name: services.name, groupCode: services.groupCode })
      .from(services);
    names = new Map(svc.map((s) => [s.serviceId, s.name || s.groupCode]));
  }

  const [totals] = await db.select({ ...AGG, ...AGG_EXTRA }).from(transactions).where(where);

  return NextResponse.json({
    type,
    rows: rows.map((r) => ({
      key: r.key,
      label: type === "service" ? names.get(r.key) || "" : "",
      known: type === "service" ? names.has(r.key) : true,
      gross: r.gross,
      net: r.net,
      operatorShare: r.gross - r.net,
      txns: r.txns,
      success: r.success,
      failed: r.failed,
      pending: r.pending,
      refunded: r.refunded,
    })),
    totals: {
      gross: totals?.gross ?? 0,
      net: totals?.net ?? 0,
      operatorShare: (totals?.gross ?? 0) - (totals?.net ?? 0),
      txns: totals?.txns ?? 0,
      success: totals?.success ?? 0,
      failed: totals?.failed ?? 0,
      pending: totals?.pending ?? 0,
      refunded: totals?.refunded ?? 0,
    },
  });
}
