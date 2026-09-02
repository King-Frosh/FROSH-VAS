import {
  pgTable,
  serial,
  bigserial,
  text,
  numeric,
  timestamp,
  jsonb,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Registry of VAS service IDs (seeded from the uploaded sheet). */
export const services = pgTable(
  "services",
  {
    id: serial("id").primaryKey(),
    serviceId: text("service_id").notNull().unique(),
    name: text("name").notNull().default(""),
    groupCode: text("group_code").notNull().default(""),
    revSharePct: numeric("rev_share_pct", { precision: 5, scale: 2 })
      .notNull()
      .default("70"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("services_group_idx").on(t.groupCode)],
);

/** One merged import batch (or generated sample). */
export const datasets = pgTable("datasets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("import"), // import | sample
  sources: jsonb("sources").notNull().default([]),
  rowCount: integer("row_count").notNull().default(0),
  insertedCount: integer("inserted_count").notNull().default(0),
  duplicateCount: integer("duplicate_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Normalised settlement rows. Column names follow the operator Excel:
 * DATE, SERVICE PARTNER, SERVICE ID, PRICE POINT, PRODUCT ID, PRODUCT NAME,
 * TRANSACTION, COUNT, REVENUE.
 */
export const transactions = pgTable(
  "transactions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    datasetId: integer("dataset_id").references(() => datasets.id, {
      onDelete: "cascade",
    }),
    serviceId: text("service_id").notNull(),
    groupCode: text("group_code").notNull().default(""),
    servicePartner: text("service_partner"),
    productId: text("product_id"),
    productName: text("product_name"),
    transactionType: text("transaction_type"),
    txnCount: integer("txn_count").notNull().default(1),
    /** PRICE POINT — unit tariff. */
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
    /** REVENUE — gross billed (usually PRICE POINT × COUNT). */
    revenue: numeric("revenue", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Our share of REVENUE after rev-share %. */
    netRevenue: numeric("net_revenue", { precision: 14, scale: 2 }).notNull().default("0"),
    msisdn: text("msisdn"),
    reference: text("reference"),
    transactionAt: timestamp("transaction_at").notNull(),
    network: text("network"),
    status: text("status").notNull().default("success"),
    extra: jsonb("extra"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("tx_date_idx").on(t.transactionAt),
    index("tx_service_idx").on(t.serviceId),
    index("tx_status_idx").on(t.status),
    index("tx_dataset_idx").on(t.datasetId),
    index("tx_partner_idx").on(t.servicePartner),
    index("tx_product_idx").on(t.productId),
    index("tx_type_idx").on(t.transactionType),
    uniqueIndex("tx_reference_uq")
      .on(t.reference)
      .where(sql`reference is not null and reference <> ''`),
  ],
);

/** Saved filter presets. */
export const filterPresets = pgTable("filter_presets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  config: jsonb("config").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ServiceRow = typeof services.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type DatasetRow = typeof datasets.$inferSelect;
