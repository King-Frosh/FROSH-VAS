import { NextResponse } from "next/server";
import { db } from "@/db";
import { datasets, services, transactions } from "@/db/schema";
import { ensureRegistry } from "@/db/registry";
import { normalizeStatus, round2 } from "@/lib/format";
import { sql } from "drizzle-orm";

interface IncomingRow {
  serviceId?: unknown;
  servicePartner?: unknown;
  productId?: unknown;
  productName?: unknown;
  transaction?: unknown;
  count?: unknown;
  pricePoint?: unknown;
  revenue?: unknown;
  amount?: unknown;
  msisdn?: unknown;
  reference?: unknown;
  transactionAt?: unknown;
  network?: unknown;
  status?: unknown;
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === "string" ? err : "Unknown import error";
}

export async function POST(req: Request) {
  try {
    await ensureRegistry();
    const body = (await req.json().catch(() => null)) as {
      rows?: IncomingRow[];
      datasetName?: string;
      sources?: unknown;
      createDataset?: boolean;
      datasetId?: number | null;
    } | null;

    if (!body || !Array.isArray(body.rows)) {
      return NextResponse.json({ error: "Invalid payload: rows[] required" }, { status: 400 });
    }

    let datasetId: number | null = body.datasetId ?? null;
    if (body.createDataset) {
      const [ds] = await db
        .insert(datasets)
        .values({
          name: (body.datasetName || "Merged import").slice(0, 160),
          kind: "import",
          sources: (body.sources ?? []) as never,
        })
        .returning({ id: datasets.id });
      datasetId = ds?.id ?? null;
    }

    const svcRows = await db
      .select({ serviceId: services.serviceId, revSharePct: services.revSharePct, name: services.name })
      .from(services);
    const share = new Map(svcRows.map((s) => [s.serviceId, Number(s.revSharePct)]));
    const names = new Map(svcRows.map((s) => [s.serviceId, s.name]));

    const clean: typeof transactions.$inferInsert[] = [];
    let skipped = 0;
    for (const r of body.rows) {
      const serviceId = String(r?.serviceId ?? "").replace(/\s+/g, "");
      const at = r?.transactionAt ? new Date(String(r.transactionAt)) : null;
      if (!serviceId || !at || isNaN(at.getTime())) {
        skipped++;
        continue;
      }
      const pricePoint = round2(Number(r?.pricePoint ?? r?.amount) || 0);
      const txnCount = Math.max(0, Math.round(Number(r?.count) || 0));
      let gross = round2(Number(r?.revenue) || 0);
      if (!gross && pricePoint && txnCount) gross = round2(pricePoint * txnCount);
      const sharePct = share.get(serviceId) ?? 70;
      const partner = String(r?.servicePartner ?? r?.network ?? "").trim();
      const txnType = String(r?.transaction ?? "").trim();
      const productName = String(r?.productName ?? "").trim() || names.get(serviceId) || "";
      clean.push({
        datasetId,
        serviceId,
        groupCode: serviceId.slice(0, 6),
        servicePartner: partner || null,
        productId: r?.productId == null || String(r.productId).trim() === "" ? null : String(r.productId).trim(),
        productName: productName || null,
        transactionType: txnType || null,
        txnCount: txnCount || 1,
        amount: String(pricePoint),
        revenue: String(gross),
        netRevenue: String(round2((gross * sharePct) / 100)),
        msisdn: r?.msisdn == null || r.msisdn === "" ? null : String(r.msisdn).trim(),
        reference: r?.reference == null || r.reference === "" ? null : String(r.reference).trim(),
        transactionAt: at,
        network: partner || null,
        status: r?.status ? String(r.status) : normalizeStatus(txnType || "success"),
      });
    }

    let inserted = 0;
    const CHUNK = 500;
    for (let i = 0; i < clean.length; i += CHUNK) {
      const batch = clean.slice(i, i + CHUNK);
      const res = await db
        .insert(transactions)
        .values(batch)
        .onConflictDoNothing()
        .returning({ id: transactions.id });
      inserted += res.length;
    }
    const duplicates = clean.length - inserted;

    if (datasetId != null) {
      await db
        .update(datasets)
        .set({
          rowCount: sql`row_count + ${inserted}`,
          insertedCount: sql`inserted_count + ${inserted}`,
          duplicateCount: sql`duplicate_count + ${duplicates}`,
          skippedCount: sql`skipped_count + ${skipped}`,
        })
        .where(sql`${datasets.id} = ${datasetId}`);
    }

    return NextResponse.json({ ok: true, datasetId, inserted, duplicates, skipped });
  } catch (err) {
    const detail = messageOf(err);
    console.error("[import] commit failed", err);
    return NextResponse.json(
      {
        error: "Import failed",
        detail,
        hint:
          detail.includes("does not exist") || detail.includes("column")
            ? "The database schema was not up to date. The app now attempts to repair it automatically; please retry the commit."
            : "Check that DATE, SERVICE ID and REVENUE/PRICE POINT are mapped correctly, then retry.",
      },
      { status: 500 },
    );
  }
}
