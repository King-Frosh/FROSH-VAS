import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureDatabaseReady } from "@/db/init";
import { datasets, transactions } from "@/db/schema";
import { buildWhere, parseServerFilters } from "@/lib/query";
import { asc, desc, eq, sql, type SQL } from "drizzle-orm";

const SORTS: Record<string, SQL> = {
  date: sql`${transactions.transactionAt}`,
  amount: sql`${transactions.amount}::numeric`,
  revenue: sql`${transactions.revenue}::numeric`,
  service: sql`${transactions.serviceId}`,
  status: sql`${transactions.status}`,
  count: sql`${transactions.txnCount}`,
  partner: sql`${transactions.servicePartner}`,
};

export async function GET(req: Request) {
  await ensureDatabaseReady();
  const sp = new URL(req.url).searchParams;
  const f = parseServerFilters(sp);
  const where = buildWhere(f);
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(500, Math.max(10, parseInt(sp.get("pageSize") ?? "50", 10) || 50));
  const exportAll = sp.get("export") === "1";
  const [sortKey, sortDir] = (sp.get("sort") ?? "date:desc").split(":");
  const sortCol = SORTS[sortKey] ?? SORTS.date;
  const order = sortDir === "asc" ? asc(sortCol) : desc(sortCol);

  const limit = exportAll ? 100000 : pageSize;
  const offset = exportAll ? 0 : (page - 1) * pageSize;

  const rowsQ = db
    .select({
      id: transactions.id,
      datasetId: transactions.datasetId,
      datasetName: datasets.name,
      serviceId: transactions.serviceId,
      groupCode: transactions.groupCode,
      servicePartner: transactions.servicePartner,
      productId: transactions.productId,
      productName: transactions.productName,
      transactionType: transactions.transactionType,
      txnCount: transactions.txnCount,
      msisdn: transactions.msisdn,
      reference: transactions.reference,
      transactionAt: transactions.transactionAt,
      network: transactions.network,
      status: transactions.status,
      amount: transactions.amount,
      revenue: transactions.revenue,
      netRevenue: transactions.netRevenue,
    })
    .from(transactions)
    .leftJoin(datasets, eq(datasets.id, transactions.datasetId))
    .where(where)
    .orderBy(order, desc(transactions.id))
    .limit(limit)
    .offset(offset);

  const countQ = db
    .select({ total: sql<number>`count(*)::int`.mapWith(Number) })
    .from(transactions)
    .where(where);

  const [rows, countRes] = await Promise.all([rowsQ, countQ]);
  const countRow = countRes[0];

  const dto = rows.map((r) => ({
    ...r,
    amount: Number(r.amount),
    revenue: Number(r.revenue),
    netRevenue: Number(r.netRevenue),
    txnCount: Number(r.txnCount),
    transactionAt: r.transactionAt.toISOString(),
  }));

  return NextResponse.json({ rows: dto, total: countRow?.total ?? 0, page, pageSize });
}
