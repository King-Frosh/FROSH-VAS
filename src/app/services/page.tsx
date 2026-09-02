"use client";
import { useMemo, useState } from "react";
import {
  Copy,
  Download,
  Hash,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  cn,
  EmptyState,
  Input,
  Modal,
  Segmented,
  Select,
  Skeleton,
  TextArea,
  useToast,
} from "@/components/ui";
import { exportWorkbook } from "@/lib/excel";
import { fullDateLabel, money0, num, pct } from "@/lib/format";
import { refreshAll, useApi } from "@/state/filters";

interface ServiceRow {
  id: number;
  serviceId: string;
  name: string;
  groupCode: string;
  revSharePct: string;
  status: string;
  txns: number;
  gross: number;
  net: number;
  lastAt: string | Date | null;
}

export default function ServicesPage() {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<"all" | "234012" | "234102">("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ id: number; field: "name" | "revSharePct"; value: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceRow | null>(null);
  const toast = useToast();

  const url = `/api/services?stats=1&q=${encodeURIComponent(q)}&group=${group === "all" ? "" : group}&status=${status === "all" ? "" : status}`;
  const { data, loading, reload } = useApi<{ rows: ServiceRow[] }>(url);
  const rows = data?.rows ?? [];

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status === "active").length;
    const earning = rows.filter((r) => r.txns > 0).length;
    const gross = rows.reduce((a, r) => a + r.gross, 0);
    return { active, earning, gross };
  }, [rows]);

  const parsedAdd = useMemo(
    () =>
      Array.from(
        new Set(
          addText
            .split(/[\s,;]+/)
            .map((s) => s.trim())
            .filter((s) => /^\d{6,}$/.test(s)),
        ),
      ),
    [addText],
  );

  const patch = async (row: ServiceRow, body: Record<string, unknown>) => {
    const r = await fetch(`/api/services/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      reload();
      refreshAll();
    } else {
      toast.push({ tone: "error", title: "Update failed" });
    }
  };

  const commitEdit = async (row: ServiceRow) => {
    if (!editing) return;
    const v = editing.value;
    if (editing.field === "name") await patch(row, { name: v });
    else {
      const n = parseFloat(v);
      if (Number.isFinite(n) && n >= 0 && n <= 100) await patch(row, { revSharePct: n });
      else toast.push({ tone: "error", title: "Rev-share must be 0–100" });
    }
    setEditing(null);
  };

  const addIds = async () => {
    setSaving(true);
    const r = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceIds: parsedAdd }),
    });
    const d = (await r.json()) as { added?: number; attempted?: number };
    setSaving(false);
    if (r.ok) {
      toast.push({
        tone: "success",
        title: `${num(d.added ?? 0)} Service IDs added`,
        desc: (d.attempted ?? 0) - (d.added ?? 0) > 0 ? `${(d.attempted ?? 0) - (d.added ?? 0)} already existed.` : undefined,
      });
      setAddOpen(false);
      setAddText("");
      reload();
      refreshAll();
    } else {
      toast.push({ tone: "error", title: "Could not add IDs" });
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/services/${deleteTarget.id}`, { method: "DELETE" });
    toast.push({ tone: "info", title: `Removed ${deleteTarget.serviceId}` });
    setDeleteTarget(null);
    reload();
    refreshAll();
  };

  const copy = (id: string) => {
    void navigator.clipboard?.writeText(id);
    toast.push({ tone: "info", title: "Copied to clipboard", desc: id });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Registered Service IDs" value={num(rows.length)} icon={Hash} />
        <StatTile label="Active" value={num(stats.active)} icon={ShieldCheck} />
        <StatTile label="Earning in registry" value={num(stats.earning)} icon={ShieldCheck} sub="have merged transactions" />
        <StatTile label="Lifetime gross" value={money0(stats.gross)} icon={ShieldCheck} sub="across all datasets" />
      </div>

      <Card
        bodyClass="p-0"
        title="Service registry"
        subtitle="Uploaded Service IDs — filtering, merge validation and revenue share all key off this list"
        actions={
          <div className="flex gap-2">
            <Button
              icon={Download}
              onClick={() =>
                exportWorkbook(
                  [
                    {
                      name: "Service registry",
                      rows: rows.map((r) => ({
                        "Service ID": r.serviceId,
                        Name: r.name,
                        Group: r.groupCode,
                        "Rev share %": Number(r.revSharePct),
                        Status: r.status,
                        Transactions: r.txns,
                        "Gross (NGN)": r.gross,
                        "Net (NGN)": r.net,
                      })),
                    },
                  ],
                  "vas-service-registry.xlsx",
                )
              }
            >
              Export
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>
              Add Service IDs
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
          <div className="relative w-56">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Service ID…" className="pl-7" />
          </div>
          <Segmented
            options={[
              { key: "all", label: "All groups" },
              { key: "234012", label: "234012" },
              { key: "234102", label: "234102" },
            ]}
            value={group}
            onChange={setGroup}
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>

        <div className="max-h-[58vh] overflow-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-line bg-paper/80 text-[10px] uppercase tracking-wider text-mute">
                <th className="px-3 py-2 font-semibold">Service ID</th>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Group</th>
                <th className="px-3 py-2 font-semibold">Rev share</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Txns</th>
                <th className="px-3 py-2 text-right font-semibold">Gross</th>
                <th className="px-3 py-2 text-right font-semibold">Net</th>
                <th className="px-3 py-2 font-semibold">Last activity</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-line/60">
                    <td colSpan={10} className="px-3 py-2.5"><Skeleton className="h-4" /></td>
                  </tr>
                ))}
              {!loading &&
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 transition-colors last:border-0 hover:bg-paper/60">
                    <td className="px-3 py-2">
                      <span className="group flex items-center gap-1.5">
                        <span className="num font-semibold text-ink-900">{r.serviceId}</span>
                        <button onClick={() => copy(r.serviceId)} className="rounded p-0.5 text-mute opacity-0 transition-opacity hover:text-ink-900 group-hover:opacity-100" title="Copy ID">
                          <Copy size={11} />
                        </button>
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {editing?.id === r.id && editing.field === "name" ? (
                        <Input
                          autoFocus
                          value={editing.value}
                          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                          onBlur={() => commitEdit(r)}
                          onKeyDown={(e) => e.key === "Enter" && commitEdit(r)}
                          className="w-40"
                        />
                      ) : (
                        <button
                          onClick={() => setEditing({ id: r.id, field: "name", value: r.name })}
                          className="group flex items-center gap-1.5 text-left"
                          title="Edit name"
                        >
                          <span className={r.name ? "text-ink-900" : "text-mute/60"}>{r.name || "Unnamed"}</span>
                          <Pencil size={10} className="text-mute opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={r.groupCode === "234012" ? "teal" : "gold"}>{r.groupCode}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      {editing?.id === r.id && editing.field === "revSharePct" ? (
                        <Input
                          autoFocus
                          value={editing.value}
                          inputMode="decimal"
                          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                          onBlur={() => commitEdit(r)}
                          onKeyDown={(e) => e.key === "Enter" && commitEdit(r)}
                          className="w-16"
                        />
                      ) : (
                        <button
                          onClick={() => setEditing({ id: r.id, field: "revSharePct", value: r.revSharePct })}
                          className="num group flex items-center gap-1 font-medium text-ink-900"
                          title="Edit revenue share %"
                        >
                          {pct(Number(r.revSharePct), 0)}
                          <Pencil size={10} className="text-mute opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => patch(r, { status: r.status === "active" ? "inactive" : "active" })}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors",
                          r.status === "active"
                            ? "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"
                            : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200",
                        )}
                      >
                        {r.status}
                      </button>
                    </td>
                    <td className="num px-3 py-2 text-right text-ink-900">{num(r.txns)}</td>
                    <td className="num px-3 py-2 text-right font-medium text-ink-900">{money0(r.gross)}</td>
                    <td className="num px-3 py-2 text-right font-medium text-brand-700">{money0(r.net)}</td>
                    <td className="num px-3 py-2 text-mute">
                      {r.lastAt ? fullDateLabel(new Date(r.lastAt as unknown as string)) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => setDeleteTarget(r)} className="rounded p-1 text-mute transition-colors hover:bg-red-50 hover:text-danger-600" title="Remove from registry">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && (
            <EmptyState icon={Hash} title="No Service IDs match" desc="Adjust the search or group filter." />
          )}
        </div>
      </Card>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Service IDs"
        desc="Paste one or many IDs (newline, comma or space separated). Duplicates are ignored."
        footer={
          <>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={addIds} disabled={!parsedAdd.length || saving}>
              Add {parsedAdd.length ? `(${parsedAdd.length})` : ""}
            </Button>
          </>
        }
      >
        <TextArea
          rows={8}
          value={addText}
          onChange={(e) => setAddText(e.target.value)}
          placeholder={"234102200007400\n234102200007401 …"}
        />
        <p className="mt-2 text-[11px] text-mute">
          <span className="num font-semibold text-ink-900">{parsedAdd.length}</span> valid IDs detected · group auto-derived from first 6 digits.
        </p>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove Service ID?"
        desc={`${deleteTarget?.serviceId ?? ""} will be removed from the registry. Merged transactions are kept.`}
        footer={
          <>
            <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" icon={Trash2} onClick={remove}>
              Remove
            </Button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-mute">
          Historical transactions stay in the warehouse and remain filterable, but the ID will no
          longer appear in registry-driven validation or the “known services only” merge option.
        </p>
      </Modal>
    </div>
  );
}

function StatTile({ label, value, icon: Icon, sub }: { label: string; value: string; icon: typeof Hash; sub?: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-3.5 shadow-[0_1px_2px_rgba(11,21,36,.05)] transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-mute">
        <Icon size={12} className="text-brand-600" /> {label}
      </div>
      <p className="num mt-2 text-xl font-semibold text-ink-900">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-mute">{sub}</p>}
    </div>
  );
}
