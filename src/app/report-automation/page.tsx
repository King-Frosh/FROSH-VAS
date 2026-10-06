"use client";
import { useMemo, useState } from "react";
import { Mail, Send, Settings2, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, Field, Input, Toggle, useToast } from "@/components/ui";
import { useApi } from "@/state/filters";

interface PartnerRow {
  id: number | null;
  partnerName: string;
  email: string;
  cc: string;
  enabled: boolean;
}

interface LogRow {
  id: number;
  partnerName: string;
  reportDate: string;
  recipient: string;
  status: string;
  error: string | null;
  createdAt: string;
}

function previousNigeriaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const current = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")) - 1));
  return current.toISOString().slice(0, 10);
}

export default function ReportAutomationPage() {
  const settings = useApi<{ rows: PartnerRow[] }>("/api/report-automation/settings");
  const logs = useApi<{ rows: LogRow[] }>("/api/report-automation/logs");
  const [saving, setSaving] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [date, setDate] = useState(previousNigeriaDate());
  const toast = useToast();

  const save = async (row: PartnerRow) => {
    setSaving(row.partnerName);
    try {
      const res = await fetch("/api/report-automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to save.");
      toast.push({ tone: "success", title: row.partnerName + " configuration saved" });
      settings.reload();
    } catch (error) {
      toast.push({ tone: "danger", title: error instanceof Error ? error.message : "Unable to save." });
    } finally {
      setSaving(null);
    }
  };

  const sendNow = async (row: PartnerRow) => {
    setSending(row.partnerName);
    try {
      const res = await fetch("/api/report-automation/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerName: row.partnerName, reportDate: date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to send report.");
      toast.push({
        tone: "success",
        title: "Report sent to " + row.partnerName,
        desc: (data.rows ?? 0) + " rows",
      });
      logs.reload();
    } catch (error) {
      toast.push({ tone: "danger", title: error instanceof Error ? error.message : "Unable to send." });
    } finally {
      setSending(null);
    }
  };

  const configuredCount = useMemo(
    () => settings.data?.rows.filter((r) => r.enabled && r.email).length ?? 0,
    [settings.data],
  );

  return (
    <div className="space-y-4">
      <Card title="Daily partner report automation" subtitle="Each enabled partner receives only their own settlement rows as an Excel attachment.">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-line bg-white p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-mute">Schedule</p>
            <p className="mt-1 font-semibold text-ink-900">Daily · 6:00 PM WAT</p>
            <p className="mt-0.5 text-[10px] text-mute">The report covers the previous Nigeria calendar day.</p>
          </div>
          <div className="rounded-lg border border-line bg-white p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-mute">Configured</p>
            <p className="mt-1 font-semibold text-ink-900">{configuredCount} partners enabled</p>
            <p className="mt-0.5 text-[10px] text-mute">Only enabled partners are included in the cron run.</p>
          </div>
          <div className="rounded-lg border border-line bg-white p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-mute">Manual report date</p>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>
        </div>
      </Card>

      <Card title="Partner recipients" subtitle="Enter the partner email address(es), optionally CC finance, then enable automation.">
        <div className="space-y-3">
          {(settings.data?.rows ?? []).map((row) => (
            <PartnerEditor
              key={row.partnerName}
              row={row}
              saving={saving === row.partnerName}
              sending={sending === row.partnerName}
              onSave={save}
              onSend={sendNow}
            />
          ))}
          {settings.data && settings.data.rows.length === 0 && (
            <div className="rounded-lg border border-dashed border-line p-6 text-center text-xs text-mute">
              No SERVICE PARTNER values are available yet. Merge an operator settlement file first.
            </div>
          )}
        </div>
      </Card>

      <Card title="Delivery history" subtitle="Latest 100 report attempts.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="border-b border-line bg-paper/70 text-[10px] uppercase tracking-wider text-mute">
                <th className="px-3 py-2 font-semibold">Partner</th>
                <th className="px-3 py-2 font-semibold">Report date</th>
                <th className="px-3 py-2 font-semibold">Recipient</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Time</th>
                <th className="px-3 py-2 font-semibold">Error</th>
              </tr>
            </thead>
            <tbody>
              {logs.data?.rows.map((log) => (
                <tr key={log.id} className="border-b border-line/60 last:border-0">
                  <td className="px-3 py-2 font-medium text-ink-900">{log.partnerName}</td>
                  <td className="num px-3 py-2">{log.reportDate}</td>
                  <td className="px-3 py-2 text-mute">{log.recipient}</td>
                  <td className="px-3 py-2">
                    {log.status === "sent" ? <Badge tone="green">sent</Badge> : <Badge tone="red">failed</Badge>}
                  </td>
                  <td className="num px-3 py-2 text-mute">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="max-w-[260px] truncate px-3 py-2 text-danger-600" title={log.error ?? ""}>{log.error ?? "—"}</td>
                </tr>
              ))}
              {!logs.data?.rows.length && (
                <tr><td colSpan={6} className="p-6 text-center text-xs text-mute">No report deliveries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 text-xs text-brand-800">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        <span>
          Email credentials remain server-side. Configure <strong>RESEND_API_KEY</strong>, <strong>REPORT_FROM_EMAIL</strong>, and <strong>CRON_SECRET</strong> in Vercel.
        </span>
      </div>
    </div>
  );
}

function PartnerEditor({
  row,
  saving,
  sending,
  onSave,
  onSend,
}: {
  row: PartnerRow;
  saving: boolean;
  sending: boolean;
  onSave: (row: PartnerRow) => void;
  onSend: (row: PartnerRow) => void;
}) {
  const [local, setLocal] = useState(row);
  const changed = local.email !== row.email || local.cc !== row.cc || local.enabled !== row.enabled;

  return (
    <div className="rounded-lg border border-line bg-white p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto flex items-center gap-2">
          <Mail size={15} className="text-brand-600" />
          <span className="font-semibold text-ink-900">{row.partnerName}</span>
          {local.enabled && <Badge tone="green">daily enabled</Badge>}
        </div>
        <Toggle checked={local.enabled} onChange={(checked) => setLocal((v) => ({ ...v, enabled: checked }))} label="Enable" />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Field label="Recipient email(s)" hint="Separate multiple addresses with comma or semicolon.">
          <Input value={local.email} onChange={(e) => setLocal((v) => ({ ...v, email: e.target.value }))} placeholder="partner@example.com" />
        </Field>
        <Field label="CC (optional)" hint="Finance / account manager addresses.">
          <Input value={local.cc} onChange={(e) => setLocal((v) => ({ ...v, cc: e.target.value }))} placeholder="finance@example.com" />
        </Field>
        <div className="flex items-end gap-2">
          <Button icon={Settings2} onClick={() => onSave(local)} disabled={saving || !local.email.trim()}>
            {saving ? "Saving…" : changed ? "Save" : "Saved"}
          </Button>
          <Button icon={Send} onClick={() => onSend(local)} disabled={sending || !local.email.trim()}>
            {sending ? "Sending…" : "Send now"}
          </Button>
        </div>
      </div>
    </div>
  );
}
