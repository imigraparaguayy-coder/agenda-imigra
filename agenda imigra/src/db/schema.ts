import { pgTable, serial, varchar, text, date, timestamp, integer, numeric, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  paymentValue: numeric("payment_value", { precision: 12, scale: 2 }),
  paymentFirstDate: date("payment_first_date"),
  lastPaymentDate: date("last_payment_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("stores_name_lower_unique").on(sql`lower(${table.name})`)]);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull().references(() => stores.id),
  paidOn: date("paid_on").notNull(),
  value: numeric("value", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("payments_store_id_idx").on(table.storeId)]);

export const recordings = pgTable("recordings", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull().references(() => stores.id),
  recordingDate: date("recording_date").notNull(),
  recordingTime: varchar("recording_time", { length: 5 }).notNull(),
  publicationDate: date("publication_date").notNull(),
  publicationTime: varchar("publication_time", { length: 5 }).notNull(),
  notes: text("notes").default("").notNull(),
  status: varchar("status", { length: 32 }).default("Agendada").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("recordings_active_slot_unique").on(table.recordingDate, table.recordingTime).where(sql`${table.status} <> 'Cancelada'`),
  index("recordings_publication_date_idx").on(table.publicationDate),
  index("recordings_store_id_idx").on(table.storeId),
]);
