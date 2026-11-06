import { db } from "@/db";
import { sql } from "drizzle-orm";

const statements = [
  `CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    payment_value NUMERIC(12,2),
    payment_first_date DATE,
    last_payment_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS stores_name_lower_unique ON stores (lower(name))`,
  `CREATE TABLE IF NOT EXISTS recordings (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    recording_date DATE NOT NULL,
    recording_time VARCHAR(5) NOT NULL,
    publication_date DATE NOT NULL,
    publication_time VARCHAR(5) NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'Agendada',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS recordings_active_slot_unique ON recordings (recording_date, recording_time) WHERE status <> 'Cancelada'`,
  `CREATE INDEX IF NOT EXISTS recordings_publication_date_idx ON recordings (publication_date)`,
  `CREATE INDEX IF NOT EXISTS recordings_store_id_idx ON recordings (store_id)`,
  `CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    paid_on DATE NOT NULL,
    value NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS payments_store_id_idx ON payments (store_id)`,
];

let ensured = false;

export async function ensureSchema() {
  if (ensured) return;
  try {
    for (const statement of statements) {
      await db.execute(sql.raw(statement));
    }
    ensured = true;
  } catch (error) {
    console.error("ensureSchema falhou:", error);
  }
}
