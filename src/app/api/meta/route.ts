import { NextResponse } from "next/server";
import { db } from "@/db";
import { datasets, services, transactions } from "@/db/schema";
import { ensureRegistry } from "@/db/registry";
import { count, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureRegistry();
  const [
    networksRes,
    statusesRes,
    groupsRes,
    partnersRes,
    txnTypesRes,
    boundsRes,
    txCountRes,
    svcCountRes,
    dsCountRes,
    coverageRes,
  ] = await Promise.all([
      db.selectDistinct({ network: transactions.network }).from(transactions).where(sql`${transactions.network} is not null`),
      db.selectDistinct({ status: transactions.status }).from(transactions),
      db.selectDistinct({ groupCode: transactions.groupCode }).from(transactions),
      db
        .selectDistinct({ partner: transactions.servicePartner })
        .from(transactions)
        .where(sql`${transactions.servicePartner} is not null`),
      db
        .selectDistinct({ txnType: transactions.transactionType })
        .from(transactions)
        .where(sql`${transactions.transactionType} is not null`),
      db
        .select({
          min: sql<string>`min(${transactions.transactionAt})`.as("min"),
          max: sql<string>`max(${transactions.transactionAt})`.as("max"),
        })
        .from(transactions),
      db.select({ n: count() }).from(transactions),
      db.select({ n: count() }).from(services),
      db.select({ n: count() }).from(datasets),
      db
        .select({
          matched: sql<number>`count(*) filter (where ${services.id} is not null)::int`.mapWith(Number),
          total: sql<number>`count(*)::int`.mapWith(Number),
        })
        .from(transactions)
        .leftJoin(services, eq(services.serviceId, transactions.serviceId)),
    ]);

  const bounds = boundsRes[0];
  const coverage = coverageRes[0];
  return NextResponse.json({
    networks: networksRes.map((r) => r.network).filter(Boolean).sort(),
    statuses: statusesRes.map((r) => r.status).filter(Boolean).sort(),
    groups: groupsRes.map((r) => r.groupCode).filter(Boolean).sort(),
    partners: partnersRes.map((r) => r.partner).filter(Boolean).sort(),
    txnTypes: txnTypesRes.map((r) => r.txnType).filter(Boolean).sort(),
    minDate: bounds?.min ? new Date(bounds.min as unknown as string).toISOString() : null,
    maxDate: bounds?.max ? new Date(bounds.max as unknown as string).toISOString() : null,
    txCount: txCountRes[0]?.n ?? 0,
    servicesCount: svcCountRes[0]?.n ?? 0,
    datasetsCount: dsCountRes[0]?.n ?? 0,
    coverage: coverage?.total ? coverage.matched / coverage.total : 0,
  });
}
