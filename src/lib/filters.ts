import { toISODate } from "./format";

export type RangeKey =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "mtd"
  | "lastmonth"
  | "qtd"
  | "ytd"
  | "all"
  | "custom";

export interface FilterState {
  rangeKey: RangeKey;
  from: string; // yyyy-mm-dd (used when custom)
  to: string; // yyyy-mm-dd inclusive
  serviceIds: string[];
  groups: string[];
  statuses: string[];
  networks: string[];
  partners: string[];
  txnTypes: string[];
  search: string;
  minAmount: string;
  maxAmount: string;
}

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "mtd", label: "MTD" },
  { key: "lastmonth", label: "Last month" },
  { key: "qtd", label: "QTD" },
  { key: "ytd", label: "YTD" },
  { key: "all", label: "All" },
  { key: "custom", label: "Custom" },
];

export function defaultFilters(): FilterState {
  return {
    rangeKey: "30d",
    from: "",
    to: "",
    serviceIds: [],
    groups: [],
    statuses: [],
    networks: [],
    partners: [],
    txnTypes: [],
    search: "",
    minAmount: "",
    maxAmount: "",
  };
}

/** Resolve a range key into inclusive [from, to] yyyy-mm-dd (nulls = unbounded). */
export function resolveRange(f: FilterState): { from: string | null; to: string | null } {
  const now = new Date();
  const t = toISODate(now);
  switch (f.rangeKey) {
    case "today":
      return { from: t, to: t };
    case "yesterday": {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      const y = toISODate(d);
      return { from: y, to: y };
    }
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: toISODate(d), to: t };
    }
    case "30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { from: toISODate(d), to: t };
    }
    case "mtd":
      return { from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)), to: t };
    case "lastmonth": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toISODate(s), to: toISODate(e) };
    }
    case "qtd": {
      const q = Math.floor(now.getMonth() / 3) * 3;
      return { from: toISODate(new Date(now.getFullYear(), q, 1)), to: t };
    }
    case "ytd":
      return { from: toISODate(new Date(now.getFullYear(), 0, 1)), to: t };
    case "all":
      return { from: null, to: null };
    case "custom":
      return { from: f.from || null, to: f.to || null };
  }
}

export function filtersToParams(f: FilterState): URLSearchParams {
  const sp = new URLSearchParams();
  const { from, to } = resolveRange(f);
  if (from) sp.set("from", from);
  if (to) sp.set("to", to);
  f.serviceIds.forEach((s) => sp.append("serviceIds", s));
  f.groups.forEach((s) => sp.append("groups", s));
  f.statuses.forEach((s) => sp.append("statuses", s));
  f.networks.forEach((s) => sp.append("networks", s));
  (f.partners ?? []).forEach((s) => sp.append("partners", s));
  (f.txnTypes ?? []).forEach((s) => sp.append("txnTypes", s));
  if (f.search.trim()) sp.set("search", f.search.trim());
  if (f.minAmount.trim()) sp.set("minAmount", f.minAmount.trim());
  if (f.maxAmount.trim()) sp.set("maxAmount", f.maxAmount.trim());
  return sp;
}

export function activeFilterCount(f: FilterState): number {
  let n = 0;
  if (f.rangeKey !== "30d") n++;
  n += f.serviceIds.length ? 1 : 0;
  n += f.groups.length ? 1 : 0;
  n += f.statuses.length ? 1 : 0;
  n += f.networks.length ? 1 : 0;
  n += f.partners?.length ? 1 : 0;
  n += f.txnTypes?.length ? 1 : 0;
  n += f.search.trim() ? 1 : 0;
  n += f.minAmount.trim() || f.maxAmount.trim() ? 1 : 0;
  return n;
}

/** Previous period of equal length, for delta comparisons. */
export function previousRange(f: FilterState): { from: string | null; to: string | null } {
  const { from, to } = resolveRange(f);
  if (!from || !to) return { from: null, to: null };
  const fs = new Date(`${from}T00:00:00`);
  const ts = new Date(`${to}T23:59:59`);
  const days = Math.round((ts.getTime() - fs.getTime()) / 86400000) + 1;
  const pe = new Date(fs);
  pe.setDate(pe.getDate() - 1);
  const ps = new Date(fs);
  ps.setDate(ps.getDate() - days);
  return { from: toISODate(ps), to: toISODate(pe) };
}
