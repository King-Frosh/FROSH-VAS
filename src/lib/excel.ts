"use client";
import * as XLSX from "xlsx";
import { VAS_COL_WIDTHS, VAS_HEADERS, vasRecord, type VasLine } from "@/lib/columns";

export type CanonicalField =
  | "date"
  | "servicePartner"
  | "serviceId"
  | "pricePoint"
  | "productId"
  | "productName"
  | "transaction"
  | "count"
  | "revenue";

export const CANONICAL_FIELDS: {
  key: CanonicalField;
  label: string;
  hint: string;
  required?: boolean;
}[] = [
  { key: "date", label: "DATE", hint: "Settlement date", required: true },
  { key: "servicePartner", label: "SERVICE PARTNER", hint: "Operator / content-partner name" },
  { key: "serviceId", label: "SERVICE ID", hint: "VAS Service ID from the uploaded registry", required: true },
  { key: "pricePoint", label: "PRICE POINT", hint: "Unit tariff (₦)" },
  { key: "productId", label: "PRODUCT ID", hint: "Product code under the service" },
  { key: "productName", label: "PRODUCT NAME", hint: "Human-readable product name" },
  { key: "transaction", label: "TRANSACTION", hint: "Subscription / Renewal / Unsubscription / One-Off" },
  { key: "count", label: "COUNT", hint: "Number of transactions in the line" },
  { key: "revenue", label: "REVENUE", hint: "Gross billed ₦ (PRICE POINT × COUNT if blank)", required: true },
];

const EXACT_ALIASES: Record<CanonicalField, string[]> = {
  date: ["DATE", "TXN DATE", "TRANSACTION DATE", "SETTLEMENT DATE"],
  servicePartner: ["SERVICE PARTNER", "SERVICEPARTNER", "PARTNER", "OPERATOR", "CP NAME", "CONTENT PROVIDER"],
  serviceId: ["SERVICE ID", "SERVICEID", "SID", "SHORT CODE", "SERVICE CODE"],
  pricePoint: ["PRICE POINT", "PRICEPOINT", "PRICE", "TARIFF", "AMOUNT"],
  productId: ["PRODUCT ID", "PRODUCTID", "PROD ID", "PRODUCT CODE"],
  productName: ["PRODUCT NAME", "PRODUCTNAME", "PROD NAME", "PRODUCT DESCRIPTION"],
  transaction: ["TRANSACTION", "TRANSACTION TYPE", "TXN TYPE", "TXN", "TYPE"],
  count: ["COUNT", "QTY", "QUANTITY", "VOLUME", "TXN COUNT", "TRANSACTION COUNT"],
  revenue: ["REVENUE", "GROSS REVENUE", "GROSS", "BILLED", "TOTAL REVENUE"],
};

const GUESS: Record<CanonicalField, RegExp> = {
  date: /^(date|txn[\s_.-]*date|transaction[\s_.-]*date|settlement[\s_.-]*date)$/i,
  servicePartner: /service[\s_.-]*partner|^partner$|content[\s_.-]*provider|^operator$|^cp[\s_.-]*name$/i,
  serviceId: /service[\s_.-]*id|^sid$|short[\s_.-]*code|service[\s_.-]*code/i,
  pricePoint: /price[\s_.-]*point|^price$|^tariff$|^amount$/i,
  productId: /product[\s_.-]*id|product[\s_.-]*code|^prod[\s_.-]*id$/i,
  productName: /product[\s_.-]*name|product[\s_.-]*desc/i,
  transaction: /^(transaction|txn)$|transaction[\s_.-]*type|txn[\s_.-]*type/i,
  count: /^(count|qty|quantity|volume)$|transaction[\s_.-]*count|txn[\s_.-]*count/i,
  revenue: /^(revenue|gross|billed)$|gross[\s_.-]*rev/i,
};

function normHeader(s: string): string {
  return s.trim().toUpperCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ");
}

export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { cellDates: true, dense: undefined });
}

export function sheetNames(wb: XLSX.WorkBook): string[] {
  return wb.SheetNames;
}

/** Column headers at the chosen header row (blank cells become "Column n"). */
export function sheetColumns(wb: XLSX.WorkBook, sheet: string, headerRow: number): string[] {
  const ws = wb.Sheets[sheet];
  if (!ws) return [];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const row = (matrix[headerRow] ?? []) as unknown[];
  const seen = new Map<string, number>();
  return row.map((c, i) => {
    let name = c == null || String(c).trim() === "" ? `Column ${i + 1}` : String(c).trim();
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    return n > 0 ? `${name} (${n + 1})` : name;
  });
}

/** Data rows below the header row as objects keyed by header name. */
export function sheetRows(
  wb: XLSX.WorkBook,
  sheet: string,
  headerRow: number,
): Record<string, unknown>[] {
  const ws = wb.Sheets[sheet];
  if (!ws) return [];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const header = (matrix[headerRow] ?? []) as unknown[];
  const cols = sheetColumns(wb, sheet, headerRow);
  return matrix.slice(headerRow + 1).map((r) => {
    const obj: Record<string, unknown> = {};
    header.forEach((_, i) => {
      obj[cols[i] ?? `Column ${i + 1}`] = (r as unknown[])[i] ?? null;
    });
    return obj;
  });
}

/** First row (within the top 15) that looks like a header: ≥2 textual cells. */
export function detectHeaderRow(wb: XLSX.WorkBook, sheet: string): number {
  const ws = wb.Sheets[sheet];
  if (!ws) return 0;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  for (let i = 0; i < Math.min(15, matrix.length); i++) {
    const row = (matrix[i] ?? []) as unknown[];
    const strings = row.filter((c) => typeof c === "string" && c.trim() !== "").length;
    if (strings >= 2) return i;
  }
  return 0;
}

export function guessMapping(columns: string[]): Partial<Record<CanonicalField, string>> {
  const out: Partial<Record<CanonicalField, string>> = {};
  const byNorm = new Map(columns.map((c) => [normHeader(c), c]));
  const used = new Set<string>();

  (Object.keys(EXACT_ALIASES) as CanonicalField[]).forEach((field) => {
    for (const alias of EXACT_ALIASES[field]) {
      const hit = byNorm.get(alias);
      if (hit && !used.has(hit)) {
        out[field] = hit;
        used.add(hit);
        return;
      }
    }
  });

  (Object.keys(GUESS) as CanonicalField[]).forEach((field) => {
    if (out[field]) return;
    const rx = GUESS[field];
    const hit = columns.find((c) => !used.has(c) && rx.test(c));
    if (hit) {
      out[field] = hit;
      used.add(hit);
    }
  });
  return out;
}

export interface ExportSheet {
  name: string;
  rows: Record<string, unknown>[];
}

function decorateSheet(ws: XLSX.WorkSheet, colWidths?: { wch: number }[]) {
  const ref = ws["!ref"];
  if (ref) {
    ws["!autofilter"] = { ref };
    ws["!views"] = [{ state: "frozen", ySplit: 1, topLeftCell: "A2", activeCell: "A2" }];
  }
  if (colWidths) ws["!cols"] = colWidths;
}

export function exportWorkbook(
  sheets: ExportSheet[],
  filename: string,
  bookType: "xlsx" | "csv" = "xlsx",
) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((s, i) => {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{}]);
    decorateSheet(ws);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 30) || `Sheet${i + 1}`);
  });
  XLSX.writeFile(wb, filename, { bookType });
}

/** Write a file in the exact operator layout (headers + AutoFilter). */
export function exportVasFile(lines: VasLine[], filename: string, bookType: "xlsx" | "csv" = "xlsx") {
  const dateAs = bookType === "csv" ? "iso" : "date";
  const rows = lines.length
    ? lines.map((l) => vasRecord(l, dateAs))
    : [Object.fromEntries(VAS_HEADERS.map((h) => [h, ""]))];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...VAS_HEADERS] });
  decorateSheet(ws, VAS_COL_WIDTHS);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename, { bookType });
}

export function exportVasTemplate() {
  const sample: VasLine = {
    date: new Date(),
    servicePartner: "MTN",
    serviceId: "234102200006491",
    pricePoint: 100,
    productId: "P006491",
    productName: "Daily Alert",
    transaction: "Subscription",
    count: 25,
    revenue: 2500,
  };
  exportVasFile([sample], "vas-settlement-template.xlsx");
}
