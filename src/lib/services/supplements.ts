/** F15: Birden çok takviye. Günlük kayıt ada göre tutulur (kreatin geçmişiyle uyumlu). */
import { prisma } from "../prisma";
import { HttpError } from "../api-error";
import { addDaysToDateString, getLocalDateString, getLocalTimeString } from "../date-utils";
import { formatNumberTr } from "../format";
import { mealTypeForHour } from "../meal-time";
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
      caloriesPerDose: s.caloriesPerDose,
      proteinPerDose: s.proteinPerDose,
      takenToday: mine.some((l) => l.date === date),
      takenLast7: mine.length,
    };
  });
}

export async function createSupplement(input: SupplementInput) {
  await assertUniqueName(input.name);
  const sortOrder = await prisma.supplement.count();
  return prisma.supplement.create({
    data: { ...input, notes: input.notes ?? null, caloriesPerDose: input.caloriesPerDose ?? null, proteinPerDose: input.proteinPerDose ?? null, sortOrder },
  });
}

export async function updateSupplement(id: string, patch: Partial<SupplementInput>) {
  const current = await prisma.supplement.findUnique({ where: { id } });
  if (!current) throw new HttpError("Takviye bulunamadı.", 404);
  if (patch.name) await assertUniqueName(patch.name, id);
  return prisma.supplement.update({ where: { id }, data: patch });
}

export async function deleteSupplement(id: string) {
  const [res] = await prisma.$transaction([
    prisma.supplement.deleteMany({ where: { id } }),
    // F83: takviyenin hatırlatmaları da gider.
    prisma.reminder.deleteMany({ where: { supplementId: id } }),
  ]);
  if (res.count === 0) throw new HttpError("Takviye bulunamadı.", 404);
}

/** B12: takviyenin besin değeri varsa (kalori ya da protein) "alındı" işareti günlüğe öğün yazar. */
const countsAsFood = (s: { caloriesPerDose: number | null; proteinPerDose: number | null }) =>
  (s.caloriesPerDose ?? 0) > 0 || (s.proteinPerDose ?? 0) > 0;

/**
 * Takviyeyi o gün için alındı / alınmadı işaretler. B12: besin değeri olan takviye (ör. whey)
 * alınınca günlüğe öğün olarak yazılır, geri alınınca o öğün silinir; ikinci "alındı" işareti
 * ikinci öğün açmaz.
 */
export async function logSupplement(supplementId: string, taken: boolean, date = getLocalDateString()) {
  const s = await prisma.supplement.findUnique({ where: { id: supplementId } });
  if (!s) throw new HttpError("Takviye bulunamadı.", 404);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.supplementLog.findUnique({ where: { date_name: { date, name: s.name } } });
    let foodLogId = existing?.foodLogId ?? null;

    if (!taken && foodLogId) {
      // Kullanıcı öğünü ayrıca silmiş olabilir.
      await tx.foodLog.deleteMany({ where: { id: foodLogId } });
      foodLogId = null;
    }
    const linked = foodLogId ? await tx.foodLog.findUnique({ where: { id: foodLogId }, select: { id: true } }) : null;
    if (taken && countsAsFood(s) && !linked) {
      const today = date === getLocalDateString();
      const time = today ? getLocalTimeString() : "12:00";
      const created = await tx.foodLog.create({
        data: {
          date,
          time,
          mealType: today ? mealTypeForHour(Number(time.slice(0, 2))) : "extra",
          name: `${s.name} (${formatNumberTr(s.doseAmount)} ${s.doseUnit})`,
          grams: s.doseAmount,
          caloriesSnapshot: s.caloriesPerDose ?? 0,
          proteinSnapshot: s.proteinPerDose ?? 0,
          carbsSnapshot: 0,
          fatSnapshot: 0,
        },
      });
      foodLogId = created.id;
    }

    const data = { taken, doseGrams: s.doseAmount, doseUnit: s.doseUnit, foodLogId };
    return tx.supplementLog.upsert({
      where: { date_name: { date, name: s.name } },
      update: data,
      create: { date, name: s.name, ...data },
    });
  });
}
