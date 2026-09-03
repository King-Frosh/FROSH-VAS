import { sql, and, type SQL } from "drizzle-orm";
import { transactions } from "@/db/schema";

export interface ServerFilters {
  from: Date | null;
  to: Date | null;
  serviceIds: string[];
  groups: string[];
  statuses: string[];
  networks: string[];
  partners: string[];
  txnTypes: string[];
  search: string;
  minAmount: number | null;
  maxAmount: number | null;
}

function numOrNull(v: string | null): number | null {
  if (!v || !v.trim()) return null;
  const n = parseFloat(v.replace(/[,_\s₦]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseServerFilters(sp: URLSearchParams): ServerFilters {
  const from = sp.get("from");
  const to = sp.get("to");
  const partners = [...sp.getAll("partners"), ...sp.getAll("networks")].filter(Boolean);
  return {
    from: from ? new Date(`${from}T00:00:00`) : null,
    to: to ? new Date(`${to}T23:59:59.999`) : null,
    serviceIds: sp.getAll("serviceIds").filter(Boolean),
    groups: sp.getAll("groups").filter(Boolean),
    statuses: sp.getAll("statuses").filter(Boolean),
    networks: partners,
    partners,
    txnTypes: sp.getAll("txnTypes").filter(Boolean),
    search: (sp.get("search") ?? "").trim(),
    minAmount: numOrNull(sp.get("minAmount")),
    maxAmount: numOrNull(sp.get("maxAmount")),
  };
}

export function buildWhere(f: ServerFilters): SQL | undefined {
  const c: SQL[] = [];

  // Uploaded Excel dates are parsed as local Nigeria (WAT) dates in the browser,
  // then serialized with toISOString() before being stored as PostgreSQL timestamp.
  // That means a date-only value such as 01 Aug becomes 31 Jul 23:00 in storage.
  // Filter by the Nigeria calendar date instead of comparing raw timestamps.
  const storedNigeriaDate = sql`(${transactions.transactionAt} + interval '1 hour')::date`;
  if (f.from) c.push(sql`${storedNigeriaDate} >= ${dateKey(f.from)}`);
  if (f.to) c.push(sql`${storedNigeriaDate} <= ${dateKey(f.to)}`);

  if (f.serviceIds.length) c.push(sql`${transactions.serviceId} in (${sql.join(f.serviceIds.map((s) => sql`${s}`), sql`, `)})`);
  if (f.groups.length) c.push(sql`${transactions.groupCode} in (${sql.join(f.groups.map((s) => sql`${s}`), sql`, `)})`);
  if (f.statuses.length) c.push(sql`${transactions.status} in (${sql.join(f.statuses.map((s) => sql`${s}`), sql`, `)})`);
  if (f.partners.length) {
    c.push(
      sql`coalesce(${transactions.servicePartner}, ${transactions.network}) in (${sql.join(
        f.partners.map((s) => sql`${s}`),
        sql`, `,
      )})`,
    );
  }
  if (f.txnTypes.length) {
    c.push(sql`${transactions.transactionType} in (${sql.join(f.txnTypes.map((s) => sql`${s}`), sql`, `)})`);
  }
  if (f.search) {
    const like = `%${f.search.replace(/[%_]/g, "\\$&")}%`;
    c.push(
      sql`(
        ${transactions.serviceId} ilike ${like}
        or coalesce(${transactions.productId}, '') ilike ${like}
        or coalesce(${transactions.productName}, '') ilike ${like}
        or coalesce(${transactions.servicePartner}, '') ilike ${like}
        or coalesce(${transactions.transactionType}, '') ilike ${like}
      )`,
    );
  }
  if (f.minAmount != null) c.push(sql`${transactions.revenue}::numeric >= ${f.minAmount}`);
  if (f.maxAmount != null) c.push(sql`${transactions.revenue}::numeric <= ${f.maxAmount}`);
  return c.length ? and(...c) : undefined;
}

/** Gross = file REVENUE; net = rev-share; volume = SUM(COUNT). */
export const AGG = {
  gross: sql<number>`coalesce(sum(${transactions.revenue}::numeric), 0)`.mapWith(Number),
  net: sql<number>`coalesce(sum(${transactions.netRevenue}::numeric), 0)`.mapWith(Number),
  txns: sql<number>`coalesce(sum(${transactions.txnCount}), 0)::int`.mapWith(Number),
  success: sql<number>`coalesce(sum(case when ${transactions.status} = 'success' then ${transactions.txnCount} else 0 end), 0)::int`.mapWith(Number),
  failed: sql<number>`coalesce(sum(case when ${transactions.status} = 'failed' then ${transactions.txnCount} else 0 end), 0)::int`.mapWith(Number),
  pending: sql<number>`coalesce(sum(case when ${transactions.status} = 'pending' then ${transactions.txnCount} else 0 end), 0)::int`.mapWith(Number),
  refunded: sql<number>`coalesce(sum(case when ${transactions.status} = 'refunded' then ${transactions.txnCount} else 0 end), 0)::int`.mapWith(Number),
};

export const AGG_EXTRA = {
  services: sql<number>`count(distinct ${transactions.serviceId})::int`.mapWith(Number),
  subscribers: sql<number>`count(distinct coalesce(${transactions.productId}, ${transactions.serviceId}))::int`.mapWith(Number),
  days: sql<number>`count(distinct date_trunc('day', ${transactions.transactionAt}))::int`.mapWith(Number),
};
