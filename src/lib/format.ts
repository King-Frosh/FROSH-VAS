/* Formatting + normalisation helpers shared by client and server. */

const ngn = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const ngn0 = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});
const intFmt = new Intl.NumberFormat("en-US");

export function money(n: number): string {
  return ngn.format(Number.isFinite(n) ? n : 0);
}
export function money0(n: number): string {
  return ngn0.format(Number.isFinite(n) ? n : 0);
}
export function compactMoney(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  const abs = Math.abs(v);
  if (abs >= 1e9) return `₦${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `₦${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `₦${(v / 1e3).toFixed(1)}K`;
  return ngn0.format(v);
}
export function num(n: number): string {
  return intFmt.format(Number.isFinite(n) ? n : 0);
}
export function pct(n: number, digits = 1): string {
  return `${(Number.isFinite(n) ? n : 0).toFixed(digits)}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dateLabel(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${String(dt.getDate()).padStart(2, "0")} ${MONTHS[dt.getMonth()]}`;
}
export function monthLabel(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}
export function fullDateLabel(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${String(dt.getDate()).padStart(2, "0")} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}
export function dateTimeLabel(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${String(dt.getDate()).padStart(2, "0")} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}, ${hh}:${mm}`;
}
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** "234012000013654" -> "…013654" for compact display. */
export function shortId(id: string): string {
  return id.length > 9 ? `…${id.slice(-6)}` : id;
}

/** Parse money-like cell values: "₦1,200.50", "1 200", "(500)", 1200.5 … */
export function parseAmount(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[₦NnGg][a-zA-Z]*\s?/g, "").replace(/[,_\s]/g, "");
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return negative ? -n : n;
}

export type TxStatus = "success" | "failed" | "pending" | "refunded";
export const STATUSES: TxStatus[] = ["success", "failed", "pending", "refunded"];

export function normalizeStatus(v: unknown): TxStatus {
  if (v == null || String(v).trim() === "") return "success";
  const s = String(v).toLowerCase().trim();
  if (/refund|revers/.test(s)) return "refunded";
  if (/pend|process|submit|queued/.test(s)) return "pending";
  if (/fail|error|declin|reject|timeout|insufficient|expired|abort/.test(s)) return "failed";
  if (/success|ok|delivered|complet|confirm|sent|active|^0+$|^0000$/.test(s)) return "success";
  return "failed";
}

export type DateFormat = "auto" | "dmy" | "mdy" | "ymd";

/** Robust date parsing for Excel cells (Date objects, serials, strings). */
export function parseDateValue(v: unknown, format: DateFormat = "auto"): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    // Excel serial date
    if (v > 20000 && v < 80000) {
      const ms = Math.round((v - 25569) * 86400 * 1000);
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
  const s = String(v).trim();
  if (!s) return null;
  // ISO: 2024-05-01[ T13:45[:12]]
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return mk(+m[1], +m[2], +m[3], m[4], m[5], m[6]);
  // dd/mm/yyyy or mm/dd/yyyy with optional time
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    let a = +m[1];
    let b = +m[2];
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    const mode = format === "auto" ? (a > 12 ? "dmy" : b > 12 ? "mdy" : "dmy") : format;
    if (mode === "mdy") [a, b] = [b, a];
    if (a < 1 || a > 31 || b < 1 || b > 12) return null;
    return mk(y, b, a, m[4], m[5], m[6]);
  }
  // dd-Mon-yyyy
  m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{2,4})/);
  if (m) {
    const mi = MONTHS.findIndex((mo) => mo.toLowerCase() === m![2].slice(0, 3).toLowerCase());
    if (mi >= 0) return mk(+m[3] < 100 ? 2000 + +m[3] : +m[3], mi + 1, +m[1]);
  }
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function mk(
  y: number,
  mo: number,
  d: number,
  hh?: string,
  mm?: string,
  ss?: string,
): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d, +(hh ?? 0), +(mm ?? 0), +(ss ?? 0));
  return isNaN(dt.getTime()) ? null : dt;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
