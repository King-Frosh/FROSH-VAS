import { pool } from "@/db";

const globalForInit = globalThis as typeof globalThis & {
  __vasDbReady?: Promise<void>;
};

/**
 * Production-safe, idempotent database bootstrap.
 *
 * Vercel deployments do not run local `drizzle-kit push`, so this makes the app
 * able to repair a fresh or older database at request time. Drizzle remains the
 * ORM for all normal reads/writes; this file only handles table/column/index DDL.
 */
export function ensureDatabaseReady(): Promise<void> {
  if (!globalForInit.__vasDbReady) {
    globalForInit.__vasDbReady = (async () => {
      await pool.query(`
        create table if not exists services (
          id serial primary key,
          service_id text not null,
          name text not null default '',
          group_code text not null default '',
          rev_share_pct numeric(5,2) not null default 70,
          status text not null default 'active',
          created_at timestamp not null default now()
        );

        create unique index if not exists services_service_id_unique on services (service_id);
        create index if not exists services_group_idx on services (group_code);

        create table if not exists datasets (
          id serial primary key,
          name text not null,
          kind text not null default 'import',
          sources jsonb not null default '[]'::jsonb,
          row_count integer not null default 0,
          inserted_count integer not null default 0,
          duplicate_count integer not null default 0,
          skipped_count integer not null default 0,
          created_at timestamp not null default now()
        );

        create table if not exists transactions (
          id bigserial primary key,
          dataset_id integer references datasets(id) on delete cascade,
          service_id text not null,
          group_code text not null default '',
          service_partner text,
          product_id text,
          product_name text,
          transaction_type text,
          txn_count integer not null default 1,
          amount numeric(14,2) not null default 0,
          revenue numeric(14,2) not null default 0,
          net_revenue numeric(14,2) not null default 0,
          msisdn text,
          reference text,
          transaction_at timestamp not null,
          network text,
          status text not null default 'success',
          extra jsonb,
          created_at timestamp not null default now()
        );

        create table if not exists filter_presets (
          id serial primary key,
          name text not null,
          config jsonb not null,
          created_at timestamp not null default now()
        );

        alter table services add column if not exists name text not null default '';
        alter table services add column if not exists group_code text not null default '';
        alter table services add column if not exists rev_share_pct numeric(5,2) not null default 70;
        alter table services add column if not exists status text not null default 'active';
        alter table services add column if not exists created_at timestamp not null default now();

        alter table datasets add column if not exists kind text not null default 'import';
        alter table datasets add column if not exists sources jsonb not null default '[]'::jsonb;
        alter table datasets add column if not exists row_count integer not null default 0;
        alter table datasets add column if not exists inserted_count integer not null default 0;
        alter table datasets add column if not exists duplicate_count integer not null default 0;
        alter table datasets add column if not exists skipped_count integer not null default 0;
        alter table datasets add column if not exists created_at timestamp not null default now();

        alter table transactions add column if not exists group_code text not null default '';
        alter table transactions add column if not exists service_partner text;
        alter table transactions add column if not exists product_id text;
        alter table transactions add column if not exists product_name text;
        alter table transactions add column if not exists transaction_type text;
        alter table transactions add column if not exists txn_count integer not null default 1;
        alter table transactions add column if not exists amount numeric(14,2) not null default 0;
        alter table transactions add column if not exists revenue numeric(14,2) not null default 0;
        alter table transactions add column if not exists net_revenue numeric(14,2) not null default 0;
        alter table transactions add column if not exists msisdn text;
        alter table transactions add column if not exists reference text;
        alter table transactions add column if not exists transaction_at timestamp;
        alter table transactions add column if not exists network text;
        alter table transactions add column if not exists status text not null default 'success';
        alter table transactions add column if not exists extra jsonb;
        alter table transactions add column if not exists created_at timestamp not null default now();

        alter table filter_presets add column if not exists config jsonb not null default '{}'::jsonb;
        alter table filter_presets add column if not exists created_at timestamp not null default now();

        update transactions set group_code = left(service_id, 6) where coalesce(group_code, '') = '';
        update transactions set service_partner = network where service_partner is null and network is not null;
        update transactions set net_revenue = round(revenue * 0.70, 2) where coalesce(net_revenue, 0) = 0 and revenue <> 0;

        create index if not exists tx_date_idx on transactions (transaction_at);
        create index if not exists tx_service_idx on transactions (service_id);
        create index if not exists tx_status_idx on transactions (status);
        create index if not exists tx_dataset_idx on transactions (dataset_id);
        create index if not exists tx_partner_idx on transactions (service_partner);
        create index if not exists tx_product_idx on transactions (product_id);
        create index if not exists tx_type_idx on transactions (transaction_type);
        create unique index if not exists tx_reference_uq on transactions (reference) where reference is not null and reference <> '';
      `);
    })().catch((err) => {
      globalForInit.__vasDbReady = undefined;
      throw err;
    });
  }
  return globalForInit.__vasDbReady;
}
