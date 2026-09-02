import { NextResponse } from "next/server";
import { db } from "@/db";
import { datasets, services, transactions } from "@/db/schema";
import { ensureRegistry } from "@/db/registry";
import { round2 } from "@/lib/format";
import { eq } from "drizzle-orm";

const PARTNERS = ["MTN", "Airtel", "Glo", "9mobile"];
const TXN_TYPES: { type: string; weight: number; billed: boolean }[] = [
  { type: "Subscription", weight: 0.38, billed: true },
  { type: "Renewal", weight: 0.44, billed: true },
  { type: "One-Off", weight: 0.1, billed: true },
  { type: "Unsubscription", weight: 0.08, billed: false },
];
const PRICES: Record<string, number[]> = {
  "234012": [50, 100, 200, 300, 500],
  "234102": [100, 150, 300, 500, 1000, 1500],
};
const PRODUCT_NAMES = [
  "Daily Sports Alert",
  "Love Tips",
  "Gospel Voice",
  "Job Alert",
  "Trivia Club",
  "Horoscope Daily",
  "English Tutor",
  "Lotto Tips",
  "Health Tips",
  "Biz News",
];

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickType(rnd: () => number): (typeof TXN_TYPES)[number] {
  const x = rnd();
  let acc = 0;
  for (const t of TXN_TYPES) {
    acc += t.weight;
    if (x < acc) return t;
  }
  return TXN_TYPES[0];
}

export async function POST() {
  await ensureRegistry();
  const svc = await db.select().from(services);
  if (!svc.length) return NextResponse.json({ error: "Registry empty" }, { status: 400 });

  const rnd = mulberry(20260214);
  const [ds] = await db
    .insert(datasets)
    .values({
      name: "Sample data (demo — delete anytime)",
      kind: "sample",
      sources: [{ file: "generated", sheet: "VAS settlement", rows: 1200 }],
    })
    .returning({ id: datasets.id });

  const now = new Date();
  const rows: typeof transactions.$inferInsert[] = [];
  for (let i = 0; i < 1200; i++) {
    const s = svc[Math.floor(rnd() * svc.length)];
    const daysAgo = Math.floor(Math.pow(rnd(), 1.2) * 90);
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - daysAgo);
    const prices = PRICES[s.groupCode] ?? [100, 200, 500];
    const pricePoint = prices[Math.floor(rnd() * prices.length)];
    const kind = pickType(rnd);
    const count = kind.billed ? 15 + Math.floor(rnd() * 420) : 5 + Math.floor(rnd() * 80);
    const revenue = kind.billed ? round2(pricePoint * count) : 0;
    const share = Number(s.revSharePct);
    const partner = PARTNERS[Math.floor(rnd() * PARTNERS.length)];
    const productName = PRODUCT_NAMES[Number(s.serviceId.slice(-2)) % PRODUCT_NAMES.length];
    const productId = `P${s.serviceId.slice(-6)}`;
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    rows.push({
      datasetId: ds.id,
      serviceId: s.serviceId,
      groupCode: s.groupCode,
      servicePartner: partner,
      productId,
      productName,
      transactionType: kind.type,
      txnCount: count,
      amount: String(pricePoint),
      revenue: String(revenue),
      netRevenue: String(round2((revenue * share) / 100)),
      reference: `${iso}|${partner}|${s.serviceId}|${pricePoint}|${productId}|${kind.type}|${i}`,
      transactionAt: d,
      network: partner,
      status: "success",
    });
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const res = await db
      .insert(transactions)
      .values(rows.slice(i, i + 500))
      .onConflictDoNothing()
      .returning({ id: transactions.id });
    inserted += res.length;
  }
  await db
    .update(datasets)
    .set({ rowCount: inserted, insertedCount: inserted })
    .where(eq(datasets.id, ds.id));
  return NextResponse.json({ ok: true, datasetId: ds.id, inserted });
}
