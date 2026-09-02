"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  FileSpreadsheet,
  HandCoins,
  Hash,
  Layers,
  Minus,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import FilterBar from "@/components/FilterBar";
import { DoughnutChart, HBarChart, TrendChart } from "@/components/charts";
import {
  Badge,
  Button,
  Card,
  cn,
  CountUp,
  EmptyState,
  ProgressBar,
  Reveal,
  Segmented,
  Skeleton,
  useToast,
} from "@/components/ui";
import { previousRange, resolveRange } from "@/lib/filters";
import {
  compactMoney,
  dateLabel,
  fullDateLabel,
  money,
  money0,
  monthLabel,
  num,
  pct,
  shortId,
} from "@/lib/format";
import { refreshAll, useApi, useFilters } from "@/state/filters";

interface Summary {
  gross: number;
  net: number;
  operatorShare: number;
  txns: number;
  success: number;
  failed: number;
  pending: number;
  refunded: number;
  services: number;
  subscribers: number;
  days: number;
}
interface BreakdownRow {
  key: string;
  label?: string;
  gross: number;
  net: number;
  txns: number;
  success: number;
  failed: number;
}
interface TxRow {
  id: number;
  serviceId: string;
  servicePartner: string | null;
  productName: string | null;
  transactionType: string | null;
  txnCount: number;
  amount: number;
  revenue: number;
  transactionAt: string;
  groupCode: string;
}

export default function DashboardPage() {
  const { filters, params } = useFilters();
  const [gran, setGran] = useState<"day" | "week" | "month">("day");
  const toast = useToast();
  const [seeding, setSeeding] = useState(false);

  const pstr = params.toString();
  const meta = useApi<{ txCount: number; servicesCount: number; coverage: number }>(`/api/meta`);
  const summary = useApi<Summary>(`/api/reports?mode=summary&${pstr}`);
  const prev = useApi<Summary>(`/api/reports?mode=summary&${prevParams(pstr, filters)}`, [pstr]);
  const series = useApi<{ granularity: string; rows: (BreakdownRow & { bucket: string })[] }>(
    `/api/reports?mode=timeseries&granularity=${gran}&${pstr}`,
  );
  const byNetwork = useApi<{ rows: BreakdownRow[] }>(`/api/reports?mode=breakdown&dimension=partner&limit=6&${pstr}`);
  const byService = useApi<{ rows: BreakdownRow[] }>(`/api/reports?mode=breakdown&dimension=service&limit=8&${pstr}`);
  const byGroup = useApi<{ rows: BreakdownRow[] }>(`/api/reports?mode=breakdown&dimension=group&limit=10&${pstr}`);
  const recent = useApi<{ rows: TxRow[] }>(`/api/transactions?${pstr}&pageSize=7&sort=date:desc`);
  const registry = useApi<{ rows: { serviceId: string; groupCode: string }[] }>(
    meta.data && meta.data.txCount === 0 ? "/api/services?lite=1" : null,
  );

  const range = resolveRange(filters);
  const rangeLabel = range.from
    ? `${fullDateLabel(new Date(`${range.from}T00:00:00`))} → ${fullDateLabel(new Date(`${range.to}T00:00:00`))}`
    : "All time";

  const seedSample = async () => {
    setSeeding(true);
    try {
      const r = await fetch("/api/sample", { method: "POST" });
      const d = (await r.json()) as { inserted?: number };
      toast.push({
        tone: "success",
        title: "Sample data generated",
        desc: `${num(d.inserted ?? 0)} demo transactions across the registry. Delete the dataset anytime from the merger page.`,
      });
      refreshAll();
      meta.reload();
    } catch {
      toast.push({ tone: "error", title: "Could not generate sample data" });
    } finally {
      setSeeding(false);
    }
  };

  const groupCounts = useMemo(() => {
    const m = new Map<string, number>();
    (registry.data?.rows ?? []).forEach((r) => m.set(r.groupCode, (m.get(r.groupCode) ?? 0) + 1));
    return m;
  }, [registry.data]);

  /* ------------------------------- empty state ------------------------------ */
  if (meta.data && meta.data.txCount === 0) {
    return (
      <Reveal>
        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-lg shadow-ink-900/5">
          <div className="grid md:grid-cols-[1.15fr_0.85fr]">
            <div className="relative p-8 sm:p-10">
              <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand-500 via-teal-700 to-ink-900" />
              <Badge tone="green" icon={Sparkles}>First run</Badge>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-ink-900 sm:text-4xl">
                The console is wired up.
                <br />
                Now bring the spreadsheets.
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-mute">
                Merge your operator Excel exports, and every report below — gross vs net revenue,
                success rates, per-service and per-network splits — starts reporting against your
                uploaded Service IDs.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <Link
                  href="/merge"
                  className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/30 transition-all hover:bg-brand-700 active:scale-[.98]"
                >
                  <FileSpreadsheet size={15} /> Merge your first Excel files
                </Link>
                <Button size="md" onClick={seedSample} disabled={seeding}>
                  <Sparkles size={14} className={seeding ? "animate-spin" : ""} />
                  {seeding ? "Generating…" : "Explore with sample data"}
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-mute">
                <span className="flex items-center gap-1.5"><Layers size={12} className="text-brand-600" /> De-duplicated merges by transaction reference</span>
                <span className="flex items-center gap-1.5"><HandCoins size={12} className="text-teal-700" /> Rev-share aware net revenue</span>
                <span className="flex items-center gap-1.5"><Hash size={12} className="text-amber-600" /> Registry-driven filtering</span>
              </div>
            </div>
            <div className="border-t border-line bg-ink-950 p-8 text-slate-300 md:border-l md:border-t-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Service registry loaded
              </p>
              <p className="mt-2 font-display text-4xl font-bold text-white">
                {meta.data.servicesCount}
              </p>
              <p className="mt-1 text-xs text-slate-400">Service IDs seeded from your upload</p>
              <div className="mt-5 space-y-2.5">
                {[...groupCounts.entries()].map(([g, c]) => (
                  <div key={g} className="rounded-lg bg-white/5 px-3.5 py-3">
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-sm font-semibold text-brand-500">{g}</span>
                      <span className="num text-xs text-slate-400">{c} IDs</span>
                    </div>
                    <ProgressBar value={(c / Math.max(1, meta.data!.servicesCount)) * 100} className="mt-2 bg-white/10" />
                  </div>
                ))}
              </div>
              <p className="mt-5 text-[11px] leading-relaxed text-slate-500">
                Mapping validation, “known services only” merging and revenue-share percentages all
                key off this registry. Manage it under <span className="text-slate-300">Service registry</span>.
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    );
  }

  const s = summary.data;
  const p = prev.data;
  const totalGross = byGroup.data?.rows.reduce((a, r) => a + r.gross, 0) || 1;

  return (
    <div className="space-y-4">
      <FilterBar />

      {/* Hero metric */}
      <Reveal>
        <div className="relative overflow-hidden rounded-lg border border-line bg-white p-5 shadow-[0_1px_2px_rgba(11,21,36,.05)]">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-500/8 blur-3xl" />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-mute">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-brand-500" /> Gross revenue · {rangeLabel}
              </p>
              <p className="mt-1.5 font-display text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">
                {s ? <CountUp value={s.gross} format={money0} /> : <Skeleton className="h-10 w-52" />}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-mute">
                <DeltaChip cur={s?.gross} prev={p?.gross} label="vs previous period" />
                <span className="text-line">|</span>
                <span>{s ? `${num(s.txns)} transactions` : "—"}</span>
                <span className="text-line">|</span>
                <span>{s ? `${num(s.txns)} billed count` : "—"}</span>
              </div>
            </div>
            <Segmented
              options={[
                { key: "day", label: "Daily" },
                { key: "week", label: "Weekly" },
                { key: "month", label: "Monthly" },
              ]}
              value={gran}
              onChange={setGran}
            />
          </div>
        </div>
      </Reveal>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Reveal delay={40}>
          <Kpi icon={Wallet} tone="brand" label="Net revenue (our share)" value={s ? money0(s.net) : null} delta={<DeltaChip cur={s?.net} prev={p?.net} />} />
        </Reveal>
        <Reveal delay={80}>
          <Kpi icon={HandCoins} tone="gold" label="Operator share" value={s ? money0(s.operatorShare) : null} sub={s && s.gross ? `${pct((s.operatorShare / s.gross) * 100, 0)} of gross` : undefined} />
        </Reveal>
        <Reveal delay={120}>
          <Kpi
            icon={Coins}
            tone="teal"
            label="Success rate"
            value={s && s.txns ? pct((s.success / s.txns) * 100) : null}
            sub={s ? `${num(s.failed)} failed · ${num(s.pending)} pending` : undefined}
            bar={s && s.txns ? (s.success / s.txns) * 100 : 0}
          />
        </Reveal>
        <Reveal delay={160}>
          <Kpi icon={Users} tone="slate" label="Products earning" value={s ? num(s.subscribers) : null} sub={s ? `over ${s.days} active day${s.days === 1 ? "" : "s"}` : undefined} />
        </Reveal>
        <Reveal delay={200}>
          <Kpi icon={Hash} tone="ink" label="Services earning" value={s ? `${num(s.services)}` : null} sub={meta.data ? `of ${num(meta.data.servicesCount)} registered` : undefined} />
        </Reveal>
      </div>

      {/* Charts */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Reveal className="lg:col-span-2" delay={60}>
          <Card
            title="Revenue trend"
            subtitle="Gross vs net revenue with transaction volume"
            actions={
              <div className="flex items-center gap-3 text-[10px] font-medium text-mute">
                <span className="flex items-center gap-1"><i className="h-0.5 w-4 rounded bg-brand-600" /> Gross</span>
                <span className="flex items-center gap-1"><i className="h-0.5 w-4 rounded bg-teal-700" style={{ backgroundImage: "repeating-linear-gradient(90deg,#0E7490 0 4px,transparent 4px 7px)" }} /> Net</span>
                <span className="flex items-center gap-1"><i className="h-2 w-3 rounded-sm bg-ink-900/15" /> Txns</span>
              </div>
            }
          >
            {series.data ? (
              <TrendChart
                labels={series.data.rows.map((r) =>
                  series.data!.granularity === "month" ? monthLabel(r.bucket) : dateLabel(r.bucket),
                )}
                gross={series.data.rows.map((r) => r.gross)}
                net={series.data.rows.map((r) => r.net)}
                txns={series.data.rows.map((r) => r.txns)}
              />
            ) : (
              <Skeleton className="h-[280px]" />
            )}
          </Card>
        </Reveal>
        <Reveal delay={120}>
          <Card title="Revenue by SERVICE PARTNER" subtitle="Gross REVENUE share per partner">
            {byNetwork.data ? (
              <DoughnutChart
                labels={byNetwork.data.rows.map((r) => r.key)}
                values={byNetwork.data.rows.map((r) => r.gross)}
                centerLabel={s ? compactMoney(s.gross) : undefined}
              />
            ) : (
              <Skeleton className="h-[240px]" />
            )}
          </Card>
        </Reveal>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Reveal className="lg:col-span-2" delay={60}>
          <Card title="Top services by gross revenue" subtitle="Best performing Service IDs in range">
            {byService.data ? (
              <HBarChart
                labels={byService.data.rows.map((r) => shortId(r.key))}
                values={byService.data.rows.map((r) => r.gross)}
                height={Math.max(200, byService.data.rows.length * 34)}
              />
            ) : (
              <Skeleton className="h-[240px]" />
            )}
          </Card>
        </Reveal>
        <Reveal delay={120}>
          <Card title="Service group split" subtitle="Gross revenue by ID family">
            <div className="space-y-3">
              {(byGroup.data?.rows ?? []).map((g) => (
                <div key={g.key} className="rounded-lg border border-line bg-paper/60 p-3 transition-colors hover:border-brand-200 hover:bg-brand-50/40">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-sm font-bold text-ink-900">{g.key}</span>
                    <span className="num text-sm font-semibold text-brand-700">{compactMoney(g.gross)}</span>
                  </div>
                  <ProgressBar value={(g.gross / totalGross) * 100} className="mt-2" />
                  <div className="mt-2 flex justify-between text-[10px] text-mute">
                    <span>{num(g.txns)} txns · {num(g.success)} ok</span>
                    <span>net {compactMoney(g.net)}</span>
                  </div>
                </div>
              ))}
              {!byGroup.data && <Skeleton className="h-24" />}
            </div>
          </Card>
        </Reveal>
      </div>

      {/* Recent activity */}
      <Reveal delay={60}>
        <Card
          title="Latest transactions"
          subtitle="Most recent merged rows"
          bodyClass="p-0"
          actions={
            <Link href="/transactions" className="text-[11px] font-semibold text-brand-700 hover:text-brand-800">
              View all →
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wider text-mute">
                  <th className="px-4 py-2 font-semibold">DATE</th>
                  <th className="px-4 py-2 font-semibold">SERVICE PARTNER</th>
                  <th className="px-4 py-2 font-semibold">SERVICE ID</th>
                  <th className="px-4 py-2 font-semibold">PRODUCT NAME</th>
                  <th className="px-4 py-2 font-semibold">TRANSACTION</th>
                  <th className="px-4 py-2 text-right font-semibold">COUNT</th>
                  <th className="px-4 py-2 text-right font-semibold">REVENUE</th>
                </tr>
              </thead>
              <tbody>
                {(recent.data?.rows ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-line/60 transition-colors last:border-0 hover:bg-paper/70">
                    <td className="num whitespace-nowrap px-4 py-2 text-mute">{fullDateLabel(r.transactionAt)}</td>
                    <td className="px-4 py-2">{r.servicePartner ?? "—"}</td>
                    <td className="num px-4 py-2 font-medium text-ink-900">{r.serviceId}</td>
                    <td className="max-w-[160px] truncate px-4 py-2 text-mute">{r.productName ?? "—"}</td>
                    <td className="px-4 py-2 text-mute">{r.transactionType ?? "—"}</td>
                    <td className="num px-4 py-2 text-right text-ink-900">{num(r.txnCount)}</td>
                    <td className="num px-4 py-2 text-right font-semibold text-ink-900">{money(r.revenue)}</td>
                  </tr>
                ))}
                {!recent.data && (
                  <tr>
                    <td colSpan={7} className="p-4"><Skeleton className="h-16" /></td>
                  </tr>
                )}
                {recent.data && recent.data.rows.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState icon={FileSpreadsheet} title="No settlement rows in this range" desc="Widen the date range or merge new Excel files." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}

function prevParams(pstr: string, filters: ReturnType<typeof useFilters>["filters"]): string {
  const sp = new URLSearchParams(pstr);
  const pr = previousRange(filters);
  if (!pr.from || !pr.to) {
    sp.delete("from");
    sp.delete("to");
    return sp.toString();
  }
  sp.set("from", pr.from);
  sp.set("to", pr.to);
  return sp.toString();
}

function DeltaChip({ cur, prev, label }: { cur?: number; prev?: number; label?: string }) {
  if (cur == null || prev == null) return <Skeleton className="h-4 w-16" />;
  if (prev === 0)
    return (
      <span className="inline-flex items-center gap-1 rounded border border-line bg-paper px-1.5 py-0.5 text-[10px] font-semibold text-mute">
        <Minus size={10} /> no prior data
      </span>
    );
  const d = ((cur - prev) / prev) * 100;
  const up = d >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold",
        up ? "border-brand-200 bg-brand-50 text-brand-700" : "border-red-200 bg-red-50 text-red-700",
      )}
    >
      {up ? <ArrowUpRight size={10} strokeWidth={3} /> : <ArrowDownRight size={10} strokeWidth={3} />}
      {Math.abs(d).toFixed(1)}%
      {label && <span className="font-medium text-mute">{label}</span>}
    </span>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  delta,
  bar,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string | null;
  sub?: string;
  delta?: React.ReactNode;
  bar?: number;
  tone: "brand" | "gold" | "teal" | "slate" | "ink";
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700",
    gold: "bg-orange-50 text-orange-700",
    teal: "bg-cyan-50 text-teal-800",
    slate: "bg-slate-100 text-slate-700",
    ink: "bg-ink-900 text-white",
  };
  return (
    <div className="group h-full rounded-lg border border-line bg-white p-3.5 shadow-[0_1px_2px_rgba(11,21,36,.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-2">
        <span className={cn("rounded p-1.5 transition-transform group-hover:scale-110", tones[tone])}>
          <Icon size={13} strokeWidth={2.2} />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-mute">{label}</span>
      </div>
      <p className="num mt-2.5 text-xl font-semibold text-ink-900">
        {value ?? <Skeleton className="h-6 w-24" />}
      </p>
      <div className="mt-1 flex items-center gap-1.5">
        {delta}
        {sub && <span className="truncate text-[10px] text-mute">{sub}</span>}
      </div>
      {bar != null && <ProgressBar value={bar} className="mt-2" />}
    </div>
  );
}
