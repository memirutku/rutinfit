/** F15: Birden çok takviye. Günlük kayıt ada göre tutulur (kreatin geçmişiyle uyumlu). */
import { prisma } from "../prisma";
import { HttpError } from "../api-error";
import { addDaysToDateString, getLocalDateString } from "../date-utils";
import type { SupplementInput, SupplementView } from "../schemas/supplement";

const fold = (s: string) => s.trim().toLocaleLowerCase("tr-TR");

async function assertUniqueName(name: string, exceptId?: string) {
  const all = await prisma.supplement.findMany({ select: { id: true, name: true } });
  if (all.some((s) => s.id !== exceptId && fold(s.name) === fold(name))) {
    throw new HttpError(`"${name}" zaten listede.`, 409);
  }
}

export async function listSupplements(date = getLocalDateString()): Promise<SupplementView[]> {
  const [items, logs] = await Promise.all([
    prisma.supplement.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.supplementLog.findMany({ where: { taken: true, date: { gte: addDaysToDateString(date, -6), lte: date } } }),
  ]);
  return items.map((s) => {
    const mine = logs.filter((l) => l.name === s.name);
    return {
      id: s.id,
      name: s.name,
      doseAmount: s.doseAmount,
      doseUnit: s.doseUnit,
      active: s.active,
      notes: s.notes,
      takenToday: mine.some((l) => l.date === date),
      takenLast7: mine.length,
    };
  });
}

export async function createSupplement(input: SupplementInput) {
  await assertUniqueName(input.name);
  const sortOrder = await prisma.supplement.count();
  return prisma.supplement.create({ data: { ...input, notes: input.notes ?? null, sortOrder } });
}

export async function updateSupplement(id: string, patch: Partial<SupplementInput>) {
  const current = await prisma.supplement.findUnique({ where: { id } });
  if (!current) throw new HttpError("Takviye bulunamadı.", 404);
  if (patch.name) await assertUniqueName(patch.name, id);
  return prisma.supplement.update({ where: { id }, data: patch });
}

export async function deleteSupplement(id: string) {
  const res = await prisma.supplement.deleteMany({ where: { id } });
  if (res.count === 0) throw new HttpError("Takviye bulunamadı.", 404);
}

export async function logSupplement(supplementId: string, taken: boolean, date = getLocalDateString()) {
  const s = await prisma.supplement.findUnique({ where: { id: supplementId } });
  if (!s) throw new HttpError("Takviye bulunamadı.", 404);
  const data = { taken, doseGrams: s.doseAmount, doseUnit: s.doseUnit };
  return prisma.supplementLog.upsert({
    where: { date_name: { date, name: s.name } },
    update: data,
    create: { date, name: s.name, ...data },
  });
}
