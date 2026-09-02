"use client";
import { useEffect, useRef, useState } from "react";
import {
  BookmarkPlus,
  Bookmark,
  Hash,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  cn,
  Input,
  Modal,
  MultiSelect,
  Segmented,
  useToast,
} from "@/components/ui";
import { activeFilterCount, RANGE_OPTIONS, type RangeKey } from "@/lib/filters";
import { shortId } from "@/lib/format";
import { refreshAll, useApi, useFilters } from "@/state/filters";

interface MetaResp {
  networks: string[];
  groups: string[];
  partners: string[];
  txnTypes: string[];
}
interface LiteService {
  serviceId: string;
  name: string;
  groupCode: string;
  status: string;
}
interface Preset {
  id: number;
  name: string;
  config: Record<string, unknown>;
}

export default function FilterBar() {
  const { filters, set, reset } = useFilters();
  const meta = useApi<MetaResp>("/api/meta");
  const services = useApi<{ rows: LiteService[] }>("/api/services?lite=1");
  const presets = useApi<{ rows: Preset[] }>("/api/presets");
  const toast = useToast();
  const [saveOpen, setSaveOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetsOpen, setPresetsOpen] = useState(false);
  const presetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: PointerEvent) => {
      if (presetRef.current && !presetRef.current.contains(e.target as Node)) setPresetsOpen(false);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, []);

  const count = activeFilterCount(filters);
  const groups = meta.data?.groups?.length ? meta.data.groups : ["234012", "234102"];

  const toggleIn = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const savePreset = async () => {
    if (!presetName.trim()) return;
    const r = await fetch("/api/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: presetName.trim(), config: filters }),
    });
    if (r.ok) {
      toast.push({ tone: "success", title: "Preset saved", desc: `“${presetName.trim()}” is available on every page.` });
      setSaveOpen(false);
      setPresetName("");
      presets.reload();
    } else {
      toast.push({ tone: "error", title: "Could not save preset" });
    }
  };

  const deletePreset = async (id: number) => {
    await fetch(`/api/presets/${id}`, { method: "DELETE" });
    presets.reload();
  };

  return (
    <div className="no-print mb-4 rounded-lg border border-line bg-white p-3 shadow-[0_1px_2px_rgba(11,21,36,.05)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 pr-1 text-[10px] font-bold uppercase tracking-wider text-mute">
          <SlidersHorizontal size={12} /> Filters
          {count > 0 && <Badge tone="green">{count} active</Badge>}
        </span>
        <Segmented
          options={RANGE_OPTIONS}
          value={filters.rangeKey}
          onChange={(k) => set({ rangeKey: k as RangeKey })}
        />
        {filters.rangeKey === "custom" && (
          <span className="flex items-center gap-1">
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => set({ from: e.target.value })}
              className="w-[135px]"
            />
            <span className="text-[10px] text-mute">→</span>
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => set({ to: e.target.value })}
              className="w-[135px]"
            />
          </span>
        )}
        <div className="relative min-w-[170px] flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" />
          <Input
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Search Service ID, product, partner…"
            className="pl-7"
          />
        </div>
        <Button variant="ghost" icon={X} onClick={reset} disabled={count === 0}>
          Clear
        </Button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
        <MultiSelect
          placeholder="SERVICE ID"
          values={filters.serviceIds}
          onChange={(v) => set({ serviceIds: v })}
          options={(services.data?.rows ?? []).map((s) => ({
            value: s.serviceId,
            label: s.name ? `${s.name} · ${shortId(s.serviceId)}` : s.serviceId,
            hint: s.groupCode,
          }))}
          panelClass="w-96"
        />
        <span className="flex items-center gap-1">
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => set({ groups: toggleIn(filters.groups, g) })}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1.5 font-mono text-[11px] font-semibold transition-colors",
                filters.groups.includes(g)
                  ? "border-teal-700/40 bg-cyan-50 text-teal-800"
                  : "border-line bg-white text-mute hover:border-ink-900/25",
              )}
            >
              <Hash size={11} /> {g}
            </button>
          ))}
        </span>
        <MultiSelect
          placeholder="TRANSACTION"
          values={filters.txnTypes}
          onChange={(v) => set({ txnTypes: v })}
          options={(meta.data?.txnTypes?.length
            ? meta.data.txnTypes
            : ["Subscription", "Renewal", "One-Off", "Unsubscription"]
          ).map((n) => ({ value: n, label: n }))}
          panelClass="w-56"
          searchable={false}
        />
        <MultiSelect
          placeholder="SERVICE PARTNER"
          values={filters.partners}
          onChange={(v) => set({ partners: v })}
          options={(meta.data?.partners?.length ? meta.data.partners : meta.data?.networks ?? []).map((n) => ({
            value: n,
            label: n,
          }))}
          panelClass="w-52"
          searchable={false}
        />
        <span className="flex items-center gap-1">
          <Input
            value={filters.minAmount}
            onChange={(e) => set({ minAmount: e.target.value })}
            placeholder="Min ₦"
            className="w-[74px]"
            inputMode="decimal"
          />
          <span className="text-[10px] text-mute">–</span>
          <Input
            value={filters.maxAmount}
            onChange={(e) => set({ maxAmount: e.target.value })}
            placeholder="Max ₦"
            className="w-[74px]"
            inputMode="decimal"
          />
        </span>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative" ref={presetRef}>
            <Button icon={Bookmark} onClick={() => setPresetsOpen((o) => !o)}>
              Presets{presets.data?.rows.length ? ` (${presets.data.rows.length})` : ""}
            </Button>
            {presetsOpen && (
              <div className="absolute right-0 z-40 mt-1 w-64 overflow-hidden rounded-lg border border-line bg-white shadow-xl">
                <div className="max-h-56 overflow-auto p-1">
                  {(presets.data?.rows ?? []).length === 0 && (
                    <p className="p-3 text-center text-[11px] text-mute">No saved presets yet.</p>
                  )}
                  {(presets.data?.rows ?? []).map((p) => (
                    <div key={p.id} className="flex items-center gap-1 rounded px-2 py-1.5 hover:bg-paper">
                      <button
                        className="min-w-0 flex-1 truncate text-left text-xs font-medium text-ink-900"
                        onClick={() => {
                          set(p.config as never);
                          setPresetsOpen(false);
                          toast.push({ tone: "info", title: `Preset “${p.name}” applied` });
                        }}
                      >
                        {p.name}
                      </button>
                      <button
                        onClick={() => deletePreset(p.id)}
                        className="rounded p-1 text-mute hover:text-danger-600"
                        aria-label={`Delete preset ${p.name}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Button variant="dark" icon={BookmarkPlus} onClick={() => setSaveOpen(true)}>
            Save preset
          </Button>
        </div>
      </div>

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save filter preset"
        desc="Stores the current range, Service IDs, TRANSACTION types, SERVICE PARTNER and search so you can re-apply it in one click."
        footer={
          <>
            <Button onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={savePreset} disabled={!presetName.trim()}>
              Save preset
            </Button>
          </>
        }
      >
        <Input
          autoFocus
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="e.g. MTN Subscriptions — MTD"
          onKeyDown={(e) => e.key === "Enter" && savePreset()}
        />
        <p className="mt-2 text-[11px] text-mute">
          {count} active filter{count === 1 ? "" : "s"} will be stored with this preset.
        </p>
      </Modal>
    </div>
  );
}

export function useRefreshOnEvent(fn: () => void) {
  useEffect(() => {
    window.addEventListener("vas:refresh", fn);
    return () => window.removeEventListener("vas:refresh", fn);
  }, [fn]);
}

export { refreshAll };
