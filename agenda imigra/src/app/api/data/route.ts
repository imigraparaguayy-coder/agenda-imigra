import { db } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { payments, recordings, stores } from "@/db/schema";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const statuses = ["Agendada", "Gravada", "Em edição", "Pronta para publicar", "Publicada", "Cancelada"] as const;
type Status = typeof statuses[number];

function error(message: string, status = 400) { return Response.json({ error: message }, { status }); }
function dbError(err: unknown) {
  const e = err as { code?: string; cause?: { code?: string } };
  if (e.code === "23505" || e.cause?.code === "23505") return error("Já existe uma gravação neste horário ou esta loja já foi cadastrada.", 409);
  console.error(err);
  return error("Não foi possível salvar. Tente novamente.", 500);
}
function validDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
function validTime(v: unknown): v is string { return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v); }
function validStatus(v: unknown): v is Status { return statuses.includes(v as Status); }
function parseMoney(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 && v < 1e9 ? Math.round(v * 100) / 100 : null;
  const t = String(v).trim().replace(/[R$\s]/g, "");
  if (!t) return null;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : /^\d{1,3}(\.\d{3})+$/.test(t) ? Number(t.replace(/\./g, "")) : Number(t);
  return Number.isFinite(n) && n >= 0 && n < 1e9 ? Math.round(n * 100) / 100 : null;
}
function moneyValue(v: unknown) { return v === null || v === undefined ? null : Number(v); }

async function findOrCreateStore(name: string) {
  const existing = await db.select().from(stores).where(sql`lower(${stores.name}) = lower(${name})`).limit(1);
  if (existing[0]) return existing[0];
  try {
    const [created] = await db.insert(stores).values({ name }).returning();
    return created;
  } catch (e) {
    const retry = await db.select().from(stores).where(sql`lower(${stores.name}) = lower(${name})`).limit(1);
    if (retry[0]) return retry[0];
    throw e;
  }
}

export async function GET() {
  try {
    await ensureSchema();
    const [shopList, recordList, payList] = await Promise.all([
      db.select().from(stores).orderBy(asc(stores.name)),
      db.select({ id: recordings.id, storeId: recordings.storeId, storeName: stores.name, recordingDate: recordings.recordingDate, recordingTime: recordings.recordingTime, publicationDate: recordings.publicationDate, publicationTime: recordings.publicationTime, notes: recordings.notes, status: recordings.status, publishedAt: recordings.publishedAt, createdAt: recordings.createdAt, updatedAt: recordings.updatedAt }).from(recordings).innerJoin(stores, eq(recordings.storeId, stores.id)).orderBy(asc(recordings.recordingDate), asc(recordings.recordingTime)),
      db.select({ id: payments.id, storeId: payments.storeId, storeName: stores.name, paidOn: payments.paidOn, value: payments.value }).from(payments).innerJoin(stores, eq(payments.storeId, stores.id)).orderBy(desc(payments.paidOn)),
    ]);
    return Response.json({ stores: shopList.map(s => ({ ...s, paymentValue: moneyValue(s.paymentValue) })), recordings: recordList, payments: payList.map(p => ({ ...p, value: moneyValue(p.value) })) });
  } catch (e) { return dbError(e); }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    if (body.type === "store") {
      const name = String(body.name ?? "").trim();
      if (!name || name.length > 160) return error("Informe um nome de loja com até 160 caracteres.");
      if (body.paymentFirstDate && !validDate(body.paymentFirstDate)) return error("Data do primeiro recebimento inválida.");
      const paymentValue = parseMoney(body.paymentValue);
      if (body.paymentValue !== undefined && String(body.paymentValue).trim() !== "" && paymentValue === null) return error("Valor mensal inválido. Use um número, por exemplo 300,00.");
      const existing = await db.select().from(stores).where(sql`lower(${stores.name}) = lower(${name})`).limit(1);
      if (existing.length) return error("Esta loja já está cadastrada.", 409);
      const [store] = await db.insert(stores).values({ name, paymentValue: paymentValue === null ? null : String(paymentValue), paymentFirstDate: body.paymentFirstDate ? String(body.paymentFirstDate) : null }).returning();
      return Response.json({ ...store, paymentValue: moneyValue(store.paymentValue) }, { status: 201 });
    }
    if (body.type === "payment") {
      const storeId = Number(body.storeId);
      if (!Number.isInteger(storeId) || storeId < 1) return error("Loja inválida.");
      if (!validDate(body.paidOn)) return error("Data do recebimento inválida.");
      const value = parseMoney(body.value);
      if (value === null) return error("Valor do recebimento inválido.");
      const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
      if (!store) return error("Loja não encontrada.", 404);
      await db.insert(payments).values({ storeId, paidOn: String(body.paidOn), value: String(value) });
      await db.update(stores).set({ lastPaymentDate: body.paidOn }).where(eq(stores.id, storeId));
      return Response.json({ ok: true }, { status: 201 });
    }
    if (body.type !== "recording") return error("Operação inválida.");
    const storeName = String(body.storeName ?? "").trim();
    if (!storeName || storeName.length > 160) return error("Informe o nome da loja (até 160 caracteres).");
    if (!validDate(body.recordingDate) || !validDate(body.publicationDate) || !validTime(body.recordingTime) || !validTime(body.publicationTime)) return error("Informe datas e horários válidos.");
    if (body.notes && String(body.notes).length > 2000) return error("Observações devem ter no máximo 2000 caracteres.");
    const conflict = await db.select({ id: recordings.id }).from(recordings).where(and(eq(recordings.recordingDate, body.recordingDate), eq(recordings.recordingTime, body.recordingTime), ne(recordings.status, "Cancelada"))).limit(1);
    if (conflict.length) return error("Já existe outra gravação neste dia e horário. Escolha outro horário.", 409);
    const store = await findOrCreateStore(storeName);
    const [record] = await db.insert(recordings).values({ storeId: store.id, recordingDate: body.recordingDate, recordingTime: body.recordingTime, publicationDate: body.publicationDate, publicationTime: body.publicationTime, notes: String(body.notes ?? "").trim() }).returning();
    return Response.json(record, { status: 201 });
  } catch (e) { return dbError(e); }
}

export async function PATCH(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const id = Number(body.id);
    if (!Number.isInteger(id) || id < 1) return error("Identificador inválido.");
    if (body.type === "store") {
      const set: { name?: string; paymentValue?: string | null; paymentFirstDate?: string | null; lastPaymentDate?: string | null } = {};
      if (body.name !== undefined) {
        const name = String(body.name).trim();
        if (!name || name.length > 160) return error("Informe um nome de loja com até 160 caracteres.");
        const other = await db.select().from(stores).where(and(ne(stores.id, id), sql`lower(${stores.name}) = lower(${name})`)).limit(1);
        if (other.length) return error("Já existe outra loja com este nome.", 409);
        set.name = name;
      }
      if (body.paymentValue !== undefined) {
        const v = parseMoney(body.paymentValue);
        if (String(body.paymentValue).trim() !== "" && v === null) return error("Valor mensal inválido. Use um número, por exemplo 300,00.");
        set.paymentValue = v === null ? null : String(v);
      }
      if (body.paymentFirstDate !== undefined) {
        if (body.paymentFirstDate && !validDate(body.paymentFirstDate)) return error("Data do primeiro recebimento inválida.");
        set.paymentFirstDate = body.paymentFirstDate ? String(body.paymentFirstDate) : null;
      }
      if (body.resetCycle) set.lastPaymentDate = null;
      if (Object.keys(set).length) await db.update(stores).set(set).where(eq(stores.id, id));
      const [updatedStore] = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
      if (!updatedStore) return error("Loja não encontrada.", 404);
      return Response.json({ ...updatedStore, paymentValue: moneyValue(updatedStore.paymentValue) });
    }
    const [current] = await db.select().from(recordings).where(eq(recordings.id, id)).limit(1);
    if (!current) return error("Gravação não encontrada.", 404);
    if (body.type === "status") {
      if (!validStatus(body.status)) return error("Status inválido.");
      if (body.status !== "Cancelada") {
        const conflict = await db.select({ id: recordings.id }).from(recordings).where(and(eq(recordings.recordingDate, current.recordingDate), eq(recordings.recordingTime, current.recordingTime), ne(recordings.id, id), ne(recordings.status, "Cancelada"))).limit(1);
        if (conflict.length) return error("Já existe outra gravação neste horário.", 409);
      }
      const [updated] = await db.update(recordings).set({ status: body.status, publishedAt: body.status === "Publicada" ? (current.publishedAt ?? new Date()) : null, updatedAt: new Date() }).where(eq(recordings.id, id)).returning();
      return Response.json(updated);
    }
    if (body.type !== "recording") return error("Operação inválida.");
    const storeName = String(body.storeName ?? "").trim();
    if (!storeName || storeName.length > 160) return error("Informe o nome da loja (até 160 caracteres).");
    if (!validDate(body.recordingDate) || !validDate(body.publicationDate) || !validTime(body.recordingTime) || !validTime(body.publicationTime)) return error("Informe datas e horários válidos.");
    if (body.notes && String(body.notes).length > 2000) return error("Observações devem ter no máximo 2000 caracteres.");
    if (current.status !== "Cancelada") {
      const conflict = await db.select({ id: recordings.id }).from(recordings).where(and(eq(recordings.recordingDate, body.recordingDate), eq(recordings.recordingTime, body.recordingTime), ne(recordings.id, id), ne(recordings.status, "Cancelada"))).limit(1);
      if (conflict.length) return error("Já existe outra gravação neste dia e horário. Escolha outro horário.", 409);
    }
    const store = await findOrCreateStore(storeName);
    const [updated] = await db.update(recordings).set({ storeId: store.id, recordingDate: body.recordingDate, recordingTime: body.recordingTime, publicationDate: body.publicationDate, publicationTime: body.publicationTime, notes: String(body.notes ?? "").trim(), updatedAt: new Date() }).where(eq(recordings.id, id)).returning();
    return Response.json(updated);
  } catch (e) { return dbError(e); }
}

export async function DELETE(request: Request) {
  await ensureSchema();
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return error("Gravação inválida.");
  try {
    const deleted = await db.delete(recordings).where(eq(recordings.id, id)).returning({ id: recordings.id });
    if (!deleted.length) return error("Gravação não encontrada.", 404);
    return Response.json({ ok: true });
  } catch (e) { return dbError(e); }
}
