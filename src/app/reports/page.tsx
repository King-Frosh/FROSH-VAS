"use client";
import { useState } from "react";
import { Download, Printer, Table2 } from "lucide-react";
import FilterBar from "@/components/FilterBar";
import { HBarChart, TrendChart } from "@/components/charts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Segmented,
  Skeleton,
  useToast,
} from "@/components/ui";
import { exportVasFile, exportWorkbook } from "@/lib/excel";
import { fullDateLabel, money, money0, monthLabel, num, pct } from "@/lib/format";
import { useApi, useFilters } from "@/state/filters";

type ReportType = "daily" | "monthly" | "service" | "network" | "product" | "transaction";

interface Row {
  key: string;
  label: string;
  known: boolean;
  gross: number;
  net: number;
  operatorShare: number;
  txns: number;
  success: number;
  failed: number;
  pending: number;
  refunded: number;
}
interface TableResp {
  type: ReportType;
  rows: Row[];
  totals: Omit<Row, "key" | "label" | "known">;
}

const KEY_LABEL: Record<ReportType, string> = {
  daily: "DATE",
  monthly: "Month",
  service: "SERVICE ID",
  network: "SERVICE PARTNER",
  product: "PRODUCT NAME",
  transaction: "TRANSACTION",
};

function keyLabel(type: ReportType, key: string): string {
  if (type === "daily") return fullDateLabel(new Date(`${key}T00:00:00`));
  if (type === "monthly") return monthLabel(new Date(`${key}-01T00:00:00`));
  return key;
}

export default function ReportsPage() {
  const { params } = useFilters();
  const [type, setType] = useState<ReportType>("daily");
  const toast = useToast();
  const pstr = params.toString();

  const table = useApi<TableResp>(`/api/reports?mode=table&type=${type}&${pstr}`);
  const rows = table.data?.rows ?? [];
  const totals = table.data?.totals;

  const exportSettlement = async () => {
    const r = await fetch(`/api/transactions?${pstr}&export=1&sort=date:asc`);
    const d = (await r.json()) as {
      rows: {
        transactionAt: string;
        servicePartner: string | null;
        serviceId: string;
        amount: number;
        productId: string | null;
        productName: string | null;
        transactionType: string | null;
        txnCount: number;
        revenue: number;
      }[];
    };
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
      `vas-settlement-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
    toast.push({
      tone: "success",
      title: `Exported ${num(d.rows.length)} settlement rows`,
      desc: "DATE · SERVICE PARTNER · SERVICE ID · PRICE POINT · PRODUCT ID · PRODUCT NAME · TRANSACTION · COUNT · REVENUE",
    });
  };

  const exportRows = (bookType: "xlsx" | "csv") => {
    const payload = rows.map((r) => ({
      [KEY_LABEL[type]]: keyLabel(type, r.key),
      ...(type === "service" ? { Name: r.label, "In registry": r.known ? "yes" : "no" } : {}),
      "Gross (NGN)": r.gross,
      "Operator share (NGN)": r.operatorShare,
      "Net revenue (NGN)": r.net,
      COUNT: r.txns,
      Successful: r.success,
      Failed: r.failed,
      Pending: r.pending,
      Refunded: r.refunded,
      "Success rate %": r.txns ? +((r.success / r.txns) * 100).toFixed(2) : 0,
    }));
    if (totals) {
      payload.push({
        [KEY_LABEL[type]]: "TOTAL",
        ...(type === "service" ? { Name: "", "In registry": "" } : {}),
        "Gross (NGN)": totals.gross,
        "Operator share (NGN)": totals.operatorShare,
        "Net revenue (NGN)": totals.net,
        COUNT: totals.txns,
        Successful: totals.success,
        Failed: totals.failed,
        Pending: totals.pending,
        Refunded: totals.refunded,
        "Success rate %": totals.txns ? +((totals.success / totals.txns) * 100).toFixed(2) : 0,
      } as (typeof payload)[number]);
    }
    exportWorkbook([{ name: `${type} report`, rows: payload }], `vas-report-${type}-${new Date().toISOString().slice(0, 10)}.${bookType}`, bookType);
    toast.push({ tone: "success", title: `${type} report exported`, desc: bookType.toUpperCase() + " downloaded." });
  };

  return (
    <div>
      <FilterBar />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Segmented
          options={[
            { key: "daily", label: "Daily summary" },
            { key: "monthly", label: "Monthly summary" },
            { key: "service", label: "By SERVICE ID" },
            { key: "network", label: "By SERVICE PARTNER" },
            { key: "product", label: "By PRODUCT" },
            { key: "transaction", label: "By TRANSACTION" },
          ]}
          value={type}
          onChange={setType}
        />
        <div className="no-print flex items-center gap-2">
          <Button icon={Download} onClick={() => void exportSettlement()} disabled={!rows.length}>
            Settlement Excel
          </Button>
          <Button icon={Download} onClick={() => exportRows("xlsx")} disabled={!rows.length}>Summary Excel</Button>
          <Button icon={Download} onClick={() => exportRows("csv")} disabled={!rows.length}>CSV</Button>
          <Button icon={Printer} onClick={() => window.print()} disabled={!rows.length}>Print</Button>
        </div>
      </div>

      {/* Revenue split strip */}
      <div className="print-area mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SplitTile label="Gross billed" value={totals ? money0(totals.gross) : null} accent="border-t-ink-900" />
        <SplitTile label="Operator share" value={totals ? money0(totals.operatorShare) : null} accent="border-t-amber-600" sub={totals && totals.gross ? `${pct((totals.operatorShare / totals.gross) * 100, 1)} of gross` : undefined} />
        <SplitTile label="Net revenue (ours)" value={totals ? money0(totals.net) : null} accent="border-t-brand-600" sub={totals && totals.gross ? `${pct((totals.net / totals.gross) * 100, 1)} of gross` : undefined} />
        <SplitTile label="Transactions" value={totals ? num(totals.txns) : null} accent="border-t-teal-700" sub={totals && totals.txns ? `${pct((totals.success / totals.txns) * 100)} successful` : undefined} />
      </div>

      <div className="mb-4">
        <Card title={`${KEY_LABEL[type]} performance`} subtitle={type === "daily" || type === "monthly" ? "Gross vs net with volume" : "Gross revenue ranking"}>
          {table.data ? (
            type === "daily" || type === "monthly" ? (
              <TrendChart
                labels={rows.map((r) => keyLabel(type, r.key))}
                gross={rows.map((r) => r.gross)}
                net={rows.map((r) => r.net)}
                txns={rows.map((r) => r.txns)}
                height={260}
              />
            ) : (
              <HBarChart
                labels={rows.slice(0, 12).map((r) => (type === "service" ? r.key.slice(-6) : r.key))}
                values={rows.slice(0, 12).map((r) => r.gross)}
                height={Math.max(200, Math.min(12, rows.length) * 32)}
              />
            )
          ) : (
            <Skeleton className="h-[260px]" />
          )}
        </Card>
      </div>

      <Card
        className="print-area"
        bodyClass="p-0"
        title={`${KEY_LABEL[type]} breakdown`}
        subtitle="Revenue-share aware: net = gross × service rev-share for successful transactions"
      >
        <div className="max-h-[52vh] overflow-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-line bg-paper/80 text-[10px] uppercase tracking-wider text-mute">
                <th className="px-3 py-2 font-semibold">{KEY_LABEL[type]}</th>
                {type === "service" && <th className="px-3 py-2 font-semibold">Name</th>}
                <th className="px-3 py-2 text-right font-semibold">Gross</th>
                <th className="px-3 py-2 text-right font-semibold">Operator share</th>
                <th className="px-3 py-2 text-right font-semibold">Net</th>
                <th className="px-3 py-2 text-right font-semibold">COUNT</th>
                <th className="px-3 py-2 text-right font-semibold">Success</th>
                <th className="px-3 py-2 text-right font-semibold">Failed</th>
                <th className="px-3 py-2 text-right font-semibold">Success rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-line/60 transition-colors last:border-0 hover:bg-paper/60">
                  <td className={type === "service" ? "num px-3 py-2 font-semibold text-ink-900" : "px-3 py-2 font-medium text-ink-900"}>
                    {keyLabel(type, r.key)}
                    {type === "service" && !r.known && (
                      <Badge tone="amber" className="ml-2">not in registry</Badge>
                    )}
                  </td>
                  {type === "service" && <td className="px-3 py-2 text-mute">{r.label || "—"}</td>}
                  <td className="num px-3 py-2 text-right font-semibold text-ink-900">{money(r.gross)}</td>
                  <td className="num px-3 py-2 text-right text-amber-700">{money(r.operatorShare)}</td>
                  <td className="num px-3 py-2 text-right font-medium text-brand-700">{money(r.net)}</td>
                  <td className="num px-3 py-2 text-right text-ink-900">{num(r.txns)}</td>
                  <td className="num px-3 py-2 text-right text-brand-700">{num(r.success)}</td>
                  <td className="num px-3 py-2 text-right text-red-600">{num(r.failed)}</td>
                  <td className="num px-3 py-2 text-right font-medium text-ink-900">
                    {r.txns ? pct((r.success / r.txns) * 100) : "—"}
                  </td>
                </tr>
              ))}
              {!table.data && (
                <tr><td colSpan={9} className="p-4"><Skeleton className="h-24" /></td></tr>
              )}
            </tbody>
            {totals && rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-ink-900/20 bg-paper font-semibold text-ink-900">
                  <td className="px-3 py-2.5">TOTAL</td>
                  {type === "service" && <td />}
                  <td className="num px-3 py-2.5 text-right">{money(totals.gross)}</td>
                  <td className="num px-3 py-2.5 text-right text-amber-700">{money(totals.operatorShare)}</td>
                  <td className="num px-3 py-2.5 text-right text-brand-700">{money(totals.net)}</td>
                  <td className="num px-3 py-2.5 text-right">{num(totals.txns)}</td>
                  <td className="num px-3 py-2.5 text-right">{num(totals.success)}</td>
                  <td className="num px-3 py-2.5 text-right">{num(totals.failed)}</td>
                  <td className="num px-3 py-2.5 text-right">{totals.txns ? pct((totals.success / totals.txns) * 100) : "—"}</td>
                </tr>
              </tfoot>
            )}
          </table>
          {table.data && rows.length === 0 && (
            <EmptyState icon={Table2} title="Nothing to report in this range" desc="Adjust the filters above or merge new data." />
          )}
        </div>
      </Card>
    </div>
  );
}

function SplitTile({ label, value, sub, accent }: { label: string; value: string | null; sub?: string; accent: string }) {
  return (
    <div className={`rounded-lg border border-line border-t-2 bg-white p-3.5 shadow-[0_1px_2px_rgba(11,21,36,.05)] ${accent}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-mute">{label}</p>
      <p className="num mt-1.5 text-xl font-semibold text-ink-900">{value ?? <Skeleton className="h-6 w-24" />}</p>
      {sub && <p className="mt-0.5 text-[10px] text-mute">{sub}</p>}
    </div>
  );
}
