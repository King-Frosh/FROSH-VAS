"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { WorkBook } from "xlsx";
import {
  CheckCircle2,
  Database,
  FileSpreadsheet,
  GitMerge,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  cn,
  EmptyState,
  Field,
  Input,
  Modal,
  ProgressBar,
  Segmented,
  Select,
  Skeleton,
  Toggle,
  useToast,
} from "@/components/ui";
import { vasGrain } from "@/lib/columns";
import {
  CANONICAL_FIELDS,
  detectHeaderRow,
  exportVasFile,
  exportVasTemplate,
  guessMapping,
  readWorkbook,
  sheetColumns,
  sheetRows,
  type CanonicalField,
} from "@/lib/excel";
import {
  dateTimeLabel,
  money,
  num,
  parseAmount,
  parseDateValue,
  round2,
  toISODate,
  type DateFormat,
} from "@/lib/format";
import { refreshAll, useApi } from "@/state/filters";

interface PFile {
  id: string;
  name: string;
  size: number;
  wb: WorkBook;
  sheets: string[];
  sheet: string;
  headerRow: number;
  dateFormat: DateFormat;
  columns: string[];
  rows: Record<string, unknown>[];
  mapping: Partial<Record<CanonicalField, string>>;
}
interface MappedRow {
  date: Date;
  servicePartner: string;
  serviceId: string;
  pricePoint: number;
  productId: string;
  productName: string;
  transaction: string;
  count: number;
  revenue: number;
  file: string;
}
interface Dataset {
  id: number;
  name: string;
  kind: string;
  sources: { file?: string; sheet?: string; rows?: number }[];
  rowCount: number;
  insertedCount: number;
  duplicateCount: number;
  skippedCount: number;
  createdAt: string;
}

function cellString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  return String(v).trim();
}

function mapFile(f: PFile): MappedRow[] {
  const out: MappedRow[] = [];
  for (const r of f.rows) {
    const get = (k?: string) => (k ? r[k] : undefined);
    const serviceId = cellString(get(f.mapping.serviceId)).replace(/\s+/g, "");
    const date = parseDateValue(get(f.mapping.date), f.dateFormat);
    if (!serviceId || !date) continue;
    const pricePoint = parseAmount(get(f.mapping.pricePoint));
    const count = Math.max(0, Math.round(parseAmount(get(f.mapping.count))));
    let revenue = parseAmount(get(f.mapping.revenue));
    if (!revenue && pricePoint && count) revenue = round2(pricePoint * count);
    out.push({
      date,
      servicePartner: cellString(get(f.mapping.servicePartner)),
      serviceId,
      pricePoint,
      productId: cellString(get(f.mapping.productId)),
      productName: cellString(get(f.mapping.productName)),
      transaction: cellString(get(f.mapping.transaction)),
      count: count || (revenue || pricePoint ? 1 : 0),
      revenue,
      file: f.name,
    });
  }
  return out;
}

export default function MergePage() {
  const [files, setFiles] = useState<PFile[]>([]);
  const [adding, setAdding] = useState(false);
  const [drag, setDrag] = useState(false);
  const [dedupe, setDedupe] = useState(true);
  const [keep, setKeep] = useState<"first" | "last" | "sum">("sum");
  const [knownOnly, setKnownOnly] = useState(false);
  const [datasetName, setDatasetName] = useState("");
  const [committing, setCommitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ inserted: number; duplicates: number; skipped: number } | null>(null);
  const [deleteDs, setDeleteDs] = useState<Dataset | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const registry = useApi<{ rows: { serviceId: string }[] }>("/api/services?lite=1");
  const datasets = useApi<{ rows: Dataset[] }>("/api/datasets");

  const addFiles = async (list: FileList | File[]) => {
    const arr = Array.from(list);
    if (!arr.length) return;
    setAdding(true);
    for (const file of arr) {
      try {
        const wb = await readWorkbook(file);
        const sheet = wb.SheetNames[0];
        const headerRow = detectHeaderRow(wb, sheet);
        const columns = sheetColumns(wb, sheet, headerRow);
        const rows = sheetRows(wb, sheet, headerRow);
        setFiles((fs) => [
          ...fs,
          {
            id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            size: file.size,
            wb,
            sheets: wb.SheetNames,
            sheet,
            headerRow,
            dateFormat: "auto",
            columns,
            rows,
            mapping: guessMapping(columns),
          },
        ]);
      } catch {
        toast.push({ tone: "error", title: `Could not read ${file.name}`, desc: "Supported formats: .xlsx, .xls, .csv" });
      }
    }
    setAdding(false);
  };

  const updateFile = (id: string, patch: Partial<PFile>) => {
    setFiles((fs) =>
      fs.map((f) => {
        if (f.id !== id) return f;
        const next = { ...f, ...patch };
        if (patch.sheet !== undefined || patch.headerRow !== undefined) {
          const hr = next.headerRow;
          next.columns = sheetColumns(next.wb, next.sheet, hr);
          next.rows = sheetRows(next.wb, next.sheet, hr);
          next.mapping = guessMapping(next.columns);
        }
        return next;
      }),
    );
  };

  const setMapping = (fileId: string, field: CanonicalField, col: string) => {
    setFiles((fs) =>
      fs.map((f) => (f.id === fileId ? { ...f, mapping: { ...f.mapping, [field]: col || undefined } } : f)),
    );
  };

  const merge = useMemo(() => {
    const registrySet = new Set((registry.data?.rows ?? []).map((r) => r.serviceId));
    const perFile: { id: string; total: number; valid: number; unknown: number }[] = [];
    const out: MappedRow[] = [];
    const index = new Map<string, number>();
    let dups = 0;
    let totalRead = 0;
    for (const f of files) {
      const mapped = mapFile(f);
      totalRead += f.rows.length;
      let unknown = 0;
      for (const r of mapped) {
        if (knownOnly && registrySet.size && !registrySet.has(r.serviceId)) {
          unknown++;
          continue;
        }
        const key = vasGrain(r);
        if (dedupe) {
          const existing = index.get(key);
          if (existing != null) {
            dups++;
            if (keep === "last") out[existing] = r;
            else if (keep === "sum") {
              out[existing] = {
                ...out[existing],
                count: out[existing].count + r.count,
                revenue: round2(out[existing].revenue + r.revenue),
              };
            }
            continue;
          }
          index.set(key, out.length);
        }
        out.push(r);
      }
      perFile.push({ id: f.id, total: f.rows.length, valid: mapped.length, unknown });
    }
    return { out, dups, perFile, totalRead };
  }, [files, dedupe, keep, knownOnly, registry.data]);

  const fullyMapped = files.filter((f) => f.mapping.serviceId && f.mapping.date && (f.mapping.revenue || f.mapping.pricePoint)).length;

  const commit = async () => {
    if (!merge.out.length) {
      toast.push({ tone: "error", title: "Nothing to commit", desc: "Check column mapping — DATE, SERVICE ID and REVENUE (or PRICE POINT) are required." });
      return;
    }
    setCommitting(true);
    setProgress(0);
    setResult(null);
    try {
      const rows = merge.out.map((r) => ({
        serviceId: r.serviceId,
        servicePartner: r.servicePartner,
        productId: r.productId,
        productName: r.productName,
        transaction: r.transaction,
        count: r.count,
        pricePoint: r.pricePoint,
        revenue: r.revenue,
        reference: vasGrain(r),
        network: r.servicePartner,
        transactionAt: r.date.toISOString(),
      }));
      let datasetId: number | null = null;
      let inserted = 0;
      let duplicates = 0;
      let skipped = 0;
      for (let i = 0; i < rows.length; i += 800) {
        const chunk = rows.slice(i, i + 800);
        const res = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: chunk,
            createDataset: i === 0,
            datasetId,
            datasetName:
              datasetName.trim() ||
              `Merge of ${files.map((f) => f.name).join(", ").slice(0, 120)} — ${new Date().toISOString().slice(0, 10)}`,
            sources: files.map((f) => ({ file: f.name, sheet: f.sheet, rows: f.rows.length })),
          }),
        });
        const d = (await res.json().catch(() => ({}))) as {
          datasetId: number | null;
          inserted: number;
          duplicates: number;
          skipped: number;
          error?: string;
          detail?: string;
          hint?: string;
        };
        if (!res.ok) throw new Error([d.error, d.detail, d.hint].filter(Boolean).join(" — ") || "Import failed");
        datasetId = d.datasetId;
        inserted += d.inserted;
        duplicates += d.duplicates;
        skipped += d.skipped;
        setProgress(Math.round(((i + chunk.length) / rows.length) * 100));
      }
      setResult({ inserted, duplicates, skipped });
      toast.push({
        tone: "success",
        title: `Merge committed — ${num(inserted)} rows stored`,
        desc: duplicates ? `${num(duplicates)} duplicate references were skipped automatically.` : undefined,
      });
      refreshAll();
      datasets.reload();
    } catch (err) {
      toast.push({
        tone: "error",
        title: "Commit failed",
        desc: err instanceof Error ? err.message : "The server rejected the batch. Please retry.",
      });
    } finally {
      setCommitting(false);
    }
  };

  const exportPreview = () => {
    exportVasFile(
      merge.out.map((r) => ({
        date: r.date,
        servicePartner: r.servicePartner,
        serviceId: r.serviceId,
        pricePoint: r.pricePoint,
        productId: r.productId,
        productName: r.productName,
        transaction: r.transaction,
        count: r.count,
        revenue: r.revenue,
      })),
      `vas-merged-${toISODate(new Date())}.xlsx`,
    );
    toast.push({
      tone: "success",
      title: "Merged Excel exported",
      desc: "DATE · SERVICE PARTNER · SERVICE ID · PRICE POINT · PRODUCT ID · PRODUCT NAME · TRANSACTION · COUNT · REVENUE",
    });
  };

  return (
    <div className="space-y-4">
      {/* Steps */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Step n={1} title="Add operator files" desc={files.length ? `${files.length} file${files.length === 1 ? "" : "s"} staged` : "Drop .xlsx / .xls / .csv exports"} done={files.length > 0} />
        <Step n={2} title="Map columns" desc={`${fullyMapped}/${files.length || 0} files fully mapped`} done={files.length > 0 && fullyMapped === files.length} />
        <Step n={3} title="Merge & commit" desc={`${num(merge.out.length)} rows ready to store`} done={!!result} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[350px_1fr]">
        {/* Left: files */}
        <div className="space-y-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              void addFiles(e.dataTransfer.files);
            }}
            className={cn(
              "rounded-lg border-2 border-dashed p-6 text-center transition-all duration-200",
              drag ? "border-brand-500 bg-brand-50 scale-[1.01]" : "border-line bg-white/70 hover:border-brand-300",
            )}
          >
            <div className="mx-auto w-fit rounded-xl bg-brand-50 p-3 text-brand-700">
              <Upload size={20} strokeWidth={2} className={adding ? "animate-bounce" : ""} />
            </div>
            <p className="mt-3 font-display text-sm font-semibold text-ink-900">Drop Excel files here</p>
            <p className="mx-auto mt-1 max-w-[240px] text-[11px] leading-relaxed text-mute">
              Drop files that use DATE · SERVICE PARTNER · SERVICE ID · PRICE POINT · PRODUCT ID · PRODUCT NAME · TRANSACTION · COUNT · REVENUE.
            </p>
            <Button variant="primary" size="md" className="mt-3" onClick={() => inputRef.current?.click()} disabled={adding}>
              {adding ? "Reading…" : "Browse files"}
            </Button>
            <button
              type="button"
              className="mt-2 block w-full text-[11px] font-medium text-brand-700 hover:underline"
              onClick={() => {
                exportVasTemplate();
                toast.push({ tone: "info", title: "Template downloaded", desc: "Same 9 columns as your operator Excel." });
              }}
            >
              Download blank template
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                void addFiles(e.target.files ?? []);
                e.target.value = "";
              }}
            />
          </div>

          {files.map((f) => {
            const st = merge.perFile.find((p) => p.id === f.id);
            return (
              <div key={f.id} className="rounded-lg border border-line bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start gap-2">
                  <FileSpreadsheet size={15} className="mt-0.5 shrink-0 text-brand-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink-900" title={f.name}>{f.name}</p>
                    <p className="num text-[10px] text-mute">{(f.size / 1024).toFixed(0)} KB · {num(f.rows.length)} data rows</p>
                  </div>
                  <button onClick={() => setFiles((fs) => fs.filter((x) => x.id !== f.id))} className="rounded p-1 text-mute hover:bg-red-50 hover:text-danger-600" aria-label={`Remove ${f.name}`}>
                    <X size={13} />
                  </button>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <Field label="Sheet">
                    <Select value={f.sheet} onChange={(e) => updateFile(f.id, { sheet: e.target.value })} className="w-full">
                      {f.sheets.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Header row">
                    <Input
                      type="number"
                      min={0}
                      value={f.headerRow}
                      onChange={(e) => updateFile(f.id, { headerRow: Math.max(0, parseInt(e.target.value || "0", 10)) })}
                    />
                  </Field>
                  <Field label="Date format" className="col-span-2">
                    <Select value={f.dateFormat} onChange={(e) => updateFile(f.id, { dateFormat: e.target.value as DateFormat })} className="w-full">
                      <option value="auto">Auto-detect (DD/MM preferred)</option>
                      <option value="dmy">DD/MM/YYYY</option>
                      <option value="mdy">MM/DD/YYYY</option>
                      <option value="ymd">YYYY-MM-DD</option>
                    </Select>
                  </Field>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <Badge tone={st && st.valid ? "green" : "red"}>
                    {st ? `${num(st.valid)} mappable` : "—"}
                  </Badge>
                  {st && st.unknown > 0 && <Badge tone="amber">{num(st.unknown)} outside registry</Badge>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: mapping + merge */}
        <div className="space-y-4">
          <Card
            title="Column mapping"
            subtitle="Auto-guessed from headers — adjust per file if an operator uses different names"
            bodyClass="p-0"
          >
            {files.length === 0 ? (
              <EmptyState icon={FileSpreadsheet} title="No files staged yet" desc="Headers DATE, SERVICE PARTNER, SERVICE ID, PRICE POINT, PRODUCT ID, PRODUCT NAME, TRANSACTION, COUNT and REVENUE are auto-mapped. Output Excel uses this exact layout." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-line bg-paper/70 text-[10px] uppercase tracking-wider text-mute">
                      <th className="px-3 py-2 font-semibold">Canonical field</th>
                      {files.map((f) => (
                        <th key={f.id} className="px-3 py-2 font-semibold" title={f.name}>
                          <span className="block max-w-[150px] truncate">{f.name}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CANONICAL_FIELDS.map((cf) => (
                      <tr key={cf.key} className="border-b border-line/60 last:border-0">
                        <td className="px-3 py-2 align-top">
                          <span className="flex items-center gap-1 font-semibold text-ink-900">
                            {cf.label}
                            {cf.required && <span className="text-danger-600">*</span>}
                          </span>
                          <span className="mt-0.5 block max-w-[190px] text-[10px] leading-snug text-mute">{cf.hint}</span>
                        </td>
                        {files.map((f) => {
                          const col = f.mapping[cf.key] ?? "";
                          const sample = col
                            ? f.rows.slice(0, 6).map((r) => cellString(r[col])).find((s) => s !== "")
                            : undefined;
                          return (
                            <td key={f.id} className="px-3 py-2 align-top">
                              <Select
                                value={col}
                                onChange={(e) => setMapping(f.id, cf.key, e.target.value)}
                                className={cn("w-full max-w-[170px]", !col && cf.required && "border-amber-400 bg-amber-50")}
                              >
                                <option value="">— not mapped —</option>
                                {f.columns.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </Select>
                              {sample && <span className="num mt-1 block max-w-[150px] truncate text-[10px] text-mute" title={sample}>e.g. {sample}</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Merge rules & commit" subtitle="Duplicates match on DATE + SERVICE PARTNER + SERVICE ID + PRICE POINT + PRODUCT ID + TRANSACTION">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <Toggle checked={dedupe} onChange={setDedupe} label="Collapse duplicate settlement lines" />
                <div className={cn("transition-opacity", !dedupe && "pointer-events-none opacity-40")}>
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-mute">On duplicate</span>
                  <Segmented
                    options={[
                      { key: "sum", label: "Sum COUNT & REVENUE" },
                      { key: "first", label: "Keep first" },
                      { key: "last", label: "Keep last" },
                    ]}
                    value={keep}
                    onChange={setKeep}
                  />
                </div>
                <Toggle checked={knownOnly} onChange={setKnownOnly} label="Keep only rows whose Service ID is in the registry" />
                <p className="text-[10px] leading-relaxed text-mute">
                  Registry holds <span className="num font-semibold text-ink-900">{num(registry.data?.rows.length ?? 0)}</span> Service IDs.
                  Rows for unknown IDs are excluded from the merge when enabled.
                </p>
              </div>
              <div className="space-y-3">
                <Field label="Dataset name" hint="Stored with the merge for audit trail">
                  <Input
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                    placeholder={`Auto: Merge of ${files.length || "…"} files — today`}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Rows read" value={num(merge.totalRead)} />
                  <Stat label="Mappable" value={num(merge.perFile.reduce((a, p) => a + p.valid, 0))} />
                  <Stat label="Duplicates removed" value={num(merge.dups)} tone="amber" />
                  <Stat label="Final rows" value={num(merge.out.length)} tone="green" />
                </div>
                {committing && <ProgressBar value={progress} />}
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" size="md" icon={GitMerge} onClick={commit} disabled={committing || !merge.out.length}>
                    {committing ? `Committing ${progress}%` : `Commit merge (${num(merge.out.length)})`}
                  </Button>
                  <Button size="md" onClick={exportPreview} disabled={!merge.out.length}>
                    Export Excel
                  </Button>
                </div>
                {result && (
                  <div className="flex items-start gap-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2.5 text-xs text-brand-800 animate-[rise_.25s_ease-out]">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                    <span>
                      Stored <strong className="num">{num(result.inserted)}</strong> rows ·{" "}
                      <strong className="num">{num(result.duplicates)}</strong> duplicates skipped ·{" "}
                      <strong className="num">{num(result.skipped)}</strong> invalid rows ignored.{" "}
                      <Link href="/transactions" className="font-semibold underline underline-offset-2">View transactions →</Link>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {merge.out.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-md border border-line">
                <table className="w-full min-w-[640px] text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-line bg-paper/70 text-[10px] uppercase tracking-wider text-mute">
                      <th className="px-3 py-1.5 font-semibold">DATE</th>
                      <th className="px-3 py-1.5 font-semibold">SERVICE PARTNER</th>
                      <th className="px-3 py-1.5 font-semibold">SERVICE ID</th>
                      <th className="px-3 py-1.5 text-right font-semibold">PRICE POINT</th>
                      <th className="px-3 py-1.5 font-semibold">PRODUCT ID</th>
                      <th className="px-3 py-1.5 font-semibold">PRODUCT NAME</th>
                      <th className="px-3 py-1.5 font-semibold">TRANSACTION</th>
                      <th className="px-3 py-1.5 text-right font-semibold">COUNT</th>
                      <th className="px-3 py-1.5 text-right font-semibold">REVENUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {merge.out.slice(0, 6).map((r, i) => (
                      <tr key={i} className="border-b border-line/60 last:border-0">
                        <td className="num whitespace-nowrap px-3 py-1.5 text-mute">{dateTimeLabel(r.date)}</td>
                        <td className="px-3 py-1.5 text-ink-900">{r.servicePartner || "—"}</td>
                        <td className="num px-3 py-1.5 font-medium text-ink-900">{r.serviceId}</td>
                        <td className="num px-3 py-1.5 text-right text-ink-900">{money(r.pricePoint)}</td>
                        <td className="num px-3 py-1.5 text-mute">{r.productId || "—"}</td>
                        <td className="max-w-[140px] truncate px-3 py-1.5 text-mute" title={r.productName}>{r.productName || "—"}</td>
                        <td className="px-3 py-1.5 text-mute">{r.transaction || "—"}</td>
                        <td className="num px-3 py-1.5 text-right text-ink-900">{num(r.count)}</td>
                        <td className="num px-3 py-1.5 text-right font-semibold text-ink-900">{money(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-line bg-paper/50 px-3 py-1.5 text-[10px] text-mute">
                  Preview of first 6 of {num(merge.out.length)} merged rows
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Datasets */}
      <Card
        title="Stored datasets"
        subtitle="Every committed merge is versioned — delete a dataset to remove its rows"
        bodyClass="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="border-b border-line bg-paper/70 text-[10px] uppercase tracking-wider text-mute">
                <th className="px-3 py-2 font-semibold">Dataset</th>
                <th className="px-3 py-2 font-semibold">Source files</th>
                <th className="px-3 py-2 text-right font-semibold">Rows stored</th>
                <th className="px-3 py-2 text-right font-semibold">Duplicates skipped</th>
                <th className="px-3 py-2 text-right font-semibold">Invalid ignored</th>
                <th className="px-3 py-2 font-semibold">Created</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(datasets.data?.rows ?? []).map((d) => (
                <tr key={d.id} className="border-b border-line/60 transition-colors last:border-0 hover:bg-paper/60">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2 font-medium text-ink-900">
                      <Database size={12} className="text-teal-700" />
                      <span className="max-w-[260px] truncate" title={d.name}>{d.name}</span>
                      {d.kind === "sample" && <Badge tone="gold">sample</Badge>}
                    </span>
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-mute" title={(d.sources ?? []).map((s) => s.file).join(", ")}>
                    {(d.sources ?? []).map((s) => s.file).join(", ") || "—"}
                  </td>
                  <td className="num px-3 py-2 text-right font-semibold text-ink-900">{num(d.rowCount)}</td>
                  <td className="num px-3 py-2 text-right text-amber-700">{num(d.duplicateCount)}</td>
                  <td className="num px-3 py-2 text-right text-mute">{num(d.skippedCount)}</td>
                  <td className="num px-3 py-2 text-mute">{dateTimeLabel(d.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setDeleteDs(d)} className="rounded p-1 text-mute hover:bg-red-50 hover:text-danger-600" title="Delete dataset and its rows">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {!datasets.data && (
                <tr><td colSpan={7} className="p-4"><Skeleton className="h-10" /></td></tr>
              )}
              {datasets.data && datasets.data.rows.length === 0 && (
                <tr><td colSpan={7}><EmptyState icon={Database} title="No datasets yet" desc="Committed merges and generated samples appear here." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={!!deleteDs}
        onClose={() => setDeleteDs(null)}
        title="Delete dataset?"
        desc={`“${deleteDs?.name ?? ""}” and all of its ${num(deleteDs?.rowCount ?? 0)} transactions will be permanently removed.`}
        footer={
          <>
            <Button onClick={() => setDeleteDs(null)}>Cancel</Button>
            <Button
              variant="danger"
              icon={Trash2}
              onClick={async () => {
                if (!deleteDs) return;
                await fetch(`/api/datasets/${deleteDs.id}`, { method: "DELETE" });
                toast.push({ tone: "info", title: "Dataset deleted" });
                setDeleteDs(null);
                datasets.reload();
                refreshAll();
              }}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-mute">
          Reports and dashboards recalculate immediately. The service registry is unaffected.
        </p>
      </Modal>
    </div>
  );
}

function Step({ n, title, desc, done }: { n: number; title: string; desc: string; done: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border p-3 transition-all", done ? "border-brand-200 bg-brand-50/60" : "border-line bg-white")}>
      <span
        className={cn(
          "num flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          done ? "bg-brand-600 text-white" : "bg-slate-100 text-mute",
        )}
      >
        {done ? <CheckCircle2 size={14} /> : n}
      </span>
      <div className="min-w-0">
        <p className="font-display text-xs font-semibold text-ink-900">{title}</p>
        <p className="truncate text-[10px] text-mute">{desc}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "green" | "amber" }) {
  return (
    <div className="rounded-md border border-line bg-paper/60 px-2.5 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-mute">{label}</p>
      <p className={cn("num mt-0.5 text-sm font-semibold", tone === "green" ? "text-brand-700" : tone === "amber" ? "text-amber-700" : "text-ink-900")}>
        {value}
      </p>
    </div>
  );
}
