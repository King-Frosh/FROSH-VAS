"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  Table2,
} from "lucide-react";
import FilterBar from "@/components/FilterBar";
import {
  Badge,
  Button,
  Card,
  cn,
  EmptyState,
  Select,
  Skeleton,
  useToast,
} from "@/components/ui";
import { exportVasFile } from "@/lib/excel";
import { fullDateLabel, money, num } from "@/lib/format";
import { useApi, useFilters } from "@/state/filters";

interface TxRow {
  id: number;
  datasetName: string | null;
  serviceId: string;
  groupCode: string;
  servicePartner: string | null;
  productId: string | null;
  productName: string | null;
  transactionType: string | null;
  txnCount: number;
  transactionAt: string;
  amount: number;
  revenue: number;
  netRevenue: number;
}

type SortKey = "date" | "amount" | "revenue" | "service" | "count" | "partner";

const COLS: { key: SortKey | null; label: string; right?: boolean }[] = [
  { key: "date", label: "DATE" },
  { key: "partner", label: "SERVICE PARTNER" },
  { key: "service", label: "SERVICE ID" },
  { key: "amount", label: "PRICE POINT", right: true },
  { key: null, label: "PRODUCT ID" },
  { key: null, label: "PRODUCT NAME" },
  { key: null, label: "TRANSACTION" },
  { key: "count", label: "COUNT", right: true },
  { key: "revenue", label: "REVENUE", right: true },
];

export default function TransactionsPage() {
  const { params, reset } = useFilters();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  const toast = useToast();
  const [exporting, setExporting] = useState(false);

  const pstr = params.toString();
  useEffect(() => setPage(1), [pstr, pageSize, sort]);

  const url = `/api/transactions?${pstr}&page=${page}&pageSize=${pageSize}&sort=${sort.key}:${sort.dir}`;
  const { data, loading } = useApi<{ rows: TxRow[]; total: number }>(url);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  const doExport = async (bookType: "xlsx" | "csv") => {
    setExporting(true);
    try {
      const r = await fetch(`/api/transactions?${pstr}&export=1&sort=${sort.key}:${sort.dir}`);
      const d = (await r.json()) as { rows: TxRow[] };
      exportVasFile(
        d.rows.map((row) => ({
          date: new Date(row.transactionAt),
          servicePartner: row.servicePartner ?? "",
          serviceId: row.serviceId,
          pricePoint: row.amount,
          productId: row.productId ?? "",
          productName: row.productName ?? "",
          transaction: row.transactionType ?? "",
          count: row.txnCount,
          revenue: row.revenue,
        })),
        `vas-settlement-${new Date().toISOString().slice(0, 10)}.${bookType}`,
        bookType,
      );
      toast.push({
        tone: "success",
        title: `Exported ${num(d.rows.length)} rows`,
        desc: "DATE · SERVICE PARTNER · SERVICE ID · PRICE POINT · PRODUCT ID · PRODUCT NAME · TRANSACTION · COUNT · REVENUE",
      });
    } catch {
      toast.push({ tone: "error", title: "Export failed" });
    } finally {
      setExporting(false);
    }
  };

  const header = useMemo(
    () => (
      <tr className="border-b border-line bg-paper/70 text-[10px] uppercase tracking-wider text-mute">
        {COLS.map((c) => (
          <th key={c.label} className={cn("px-3 py-2 font-semibold", c.right && "text-right")}>
            {c.key ? (
              <button
                className={cn(
                  "inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-ink-900",
                  sort.key === c.key && "text-ink-900",
                )}
                onClick={() =>
                  setSort((s) =>
                    s.key === c.key ? { key: s.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key as SortKey, dir: "desc" },
                  )
                }
              >
                {c.label}
                {sort.key === c.key ? (
                  sort.dir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                ) : (
                  <ArrowUpDown size={10} className="opacity-40" />
                )}
              </button>
            ) : (
              c.label
            )}
          </th>
        ))}
      </tr>
    ),
    [sort],
  );

  return (
    <div>
      <FilterBar />
      <Card
        bodyClass="p-0"
        title={
          <span className="flex items-center gap-2">
            Settlement rows
            {data && <Badge tone="slate">{num(data.total)} rows</Badge>}
          </span>
        }
        subtitle="Same columns as the operator Excel — DATE, SERVICE PARTNER, SERVICE ID, PRICE POINT, PRODUCT ID, PRODUCT NAME, TRANSACTION, COUNT, REVENUE"
        actions={
          <div className="flex items-center gap-2">
            <Button icon={Download} onClick={() => doExport("xlsx")} disabled={exporting || !data?.rows.length}>
              Excel
            </Button>
            <Button icon={Download} onClick={() => doExport("csv")} disabled={exporting || !data?.rows.length}>
              CSV
            </Button>
          </div>
        }
      >
        <div className="max-h-[62vh] overflow-auto">
          <table className="w-full min-w-[1080px] text-left text-xs">
            <thead className="sticky top-0 z-10">{header}</thead>
            <tbody>
              {loading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-line/60">
                    <td colSpan={9} className="px-3 py-2.5">
                      <Skeleton className="h-4" />
                    </td>
                  </tr>
                ))}
              {!loading &&
                (data?.rows ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-line/60 transition-colors last:border-0 hover:bg-brand-50/30">
                    <td className="num whitespace-nowrap px-3 py-2 text-mute">{fullDateLabel(r.transactionAt)}</td>
                    <td className="px-3 py-2 font-medium text-ink-900">{r.servicePartner ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className="num font-medium text-ink-900">{r.serviceId}</span>
                      <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 font-mono text-[9px] font-semibold text-slate-600">{r.groupCode}</span>
                    </td>
                    <td className="num px-3 py-2 text-right text-ink-900">{money(r.amount)}</td>
                    <td className="num px-3 py-2 text-mute">{r.productId ?? "—"}</td>
                    <td className="max-w-[160px] truncate px-3 py-2 text-ink-900" title={r.productName ?? ""}>
                      {r.productName ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-mute">{r.transactionType ?? "—"}</td>
                    <td className="num px-3 py-2 text-right font-medium text-ink-900">{num(r.txnCount)}</td>
                    <td className="num px-3 py-2 text-right font-semibold text-brand-700">{money(r.revenue)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!loading && (data?.rows.length ?? 0) === 0 && (
            <EmptyState
              icon={Table2}
              title="No settlement rows match these filters"
              desc="Try widening the date range, clearing Service ID chips, or merge new operator files."
              action={
                <div className="flex gap-2">
                  <Button onClick={reset}>Clear filters</Button>
                  <Button variant="primary" icon={FileSpreadsheet} onClick={() => (window.location.href = "/merge")}>
                    Merge files
                  </Button>
                </div>
              }
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2.5">
          <div className="flex items-center gap-2 text-[11px] text-mute">
            <span>
              Page <span className="num font-semibold text-ink-900">{page}</span> of{" "}
              <span className="num font-semibold text-ink-900">{totalPages}</span>
            </span>
            <span className="text-line">|</span>
            <span>
              Showing <span className="num font-semibold text-ink-900">{num(Math.min(data?.total ?? 0, (page - 1) * pageSize + (data?.rows.length ?? 0)))}</span> of{" "}
              <span className="num font-semibold text-ink-900">{num(data?.total ?? 0)}</span>
            </span>
            <Select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              {[25, 50, 100, 250].map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              ← Previous
            </Button>
            <Button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Next →
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
