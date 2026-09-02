import { toISODate } from "@/lib/format";

/**
 * Canonical VAS settlement layout — matches the operator Excel the company
 * already produces, so merged output can drop straight back into finance.
 *
 * DATE | SERVICE PARTNER | SERVICE ID | PRICE POINT | PRODUCT ID | PRODUCT NAME | TRANSACTION | COUNT | REVENUE
 */
export const VAS_HEADERS = [
  "DATE",
  "SERVICE PARTNER",
  "SERVICE ID",
  "PRICE POINT",
  "PRODUCT ID",
  "PRODUCT NAME",
  "TRANSACTION",
  "COUNT",
  "REVENUE",
] as const;

export type VasHeader = (typeof VAS_HEADERS)[number];

export interface VasLine {
  date: Date;
  servicePartner: string;
  serviceId: string;
  pricePoint: number;
  productId: string;
  productName: string;
  transaction: string;
  count: number;
  revenue: number;
}

/** One output row with keys in header order (SheetJS preserves insertion order). */
export function vasRecord(line: VasLine, dateAs: "date" | "iso" = "date"): Record<VasHeader, unknown> {
  return {
    DATE: dateAs === "iso" ? toISODate(line.date) : line.date,
    "SERVICE PARTNER": line.servicePartner,
    "SERVICE ID": line.serviceId,
    "PRICE POINT": line.pricePoint,
    "PRODUCT ID": line.productId,
    "PRODUCT NAME": line.productName,
    TRANSACTION: line.transaction,
    COUNT: line.count,
    REVENUE: line.revenue,
  };
}

export const VAS_COL_WIDTHS = [
  { wch: 12 },
  { wch: 20 },
  { wch: 18 },
  { wch: 14 },
  { wch: 16 },
  { wch: 26 },
  { wch: 16 },
  { wch: 10 },
  { wch: 14 },
];

/** Grain used to de-duplicate / sum overlapping operator files. */
export function vasGrain(line: Pick<VasLine, "date" | "servicePartner" | "serviceId" | "pricePoint" | "productId" | "transaction">): string {
  return [
    toISODate(line.date),
    line.servicePartner.trim(),
    line.serviceId.trim(),
    String(line.pricePoint),
    line.productId.trim(),
    line.transaction.trim(),
  ].join("|");
}
