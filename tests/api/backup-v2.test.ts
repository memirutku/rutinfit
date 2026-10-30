import { beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@/lib/db/client";
import { datamodel } from "@/generated/datamodel";
import { GET as exportBackup } from "@/app/api/backup/export/route";
import { POST as importBackup } from "@/app/api/backup/import/route";
import { EXCLUDED_TABLES } from "@/lib/services/backup";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

beforeEach(resetDatabase);

const delegateKey = (model: string) => model.charAt(0).toLowerCase() + model.slice(1);

async function seedRichData() {
  const created = new Date("2026-01-15T08:30:00.000Z");
  await prisma.userProfile.create({ data: { id: "default-user", heightCm: 181, currentWeightKg: 110.5, createdAt: created } });
  const food = await prisma.foodItem.create({
    data: { name: "Granola", brand: "Marka A", barcode: "8690000000001", calories: 450, proteinG: 10, carbsG: 60, fatG: 15, createdAt: created },
  });
  const recipe = await prisma.recipe.create({
    data: { name: "Granola Kase", tags: JSON.stringify(["hızlı"]), servings: 2, ingredients: { create: [{ foodItemId: food.id, grams: 80 }] } },
  });
  await prisma.mealPlan.create({
    data: { date: "2026-10-19", notes: "not", meals: { create: [{ mealType: "breakfast", recipeId: recipe.id, isCompleted: true, plannedTime: "07:30" }] } },
  });
  await prisma.foodLog.create({
    data: { date: "2026-10-19", time: "07:40", mealType: "breakfast", recipeId: recipe.id, name: "Granola Kase", grams: 120, caloriesSnapshot: 270, proteinSnapshot: 6, carbsSnapshot: 36, fatSnapshot: 9 },
  });
  const tpl = await prisma.workoutTemplate.create({ data: { name: "A", type: "strength", dayOfWeek: 1, exercises: { create: [{ exerciseName: "Squat", orderIndex: 0 }] } } });
  await prisma.workoutSession.create({
    data: { date: "2026-10-19", name: "A", templateId: tpl.id, rpe: 8, setLogs: { create: [{ exerciseName: "Squat", setNumber: 1, weightKg: 90, reps: 8, isTargetMet: true }] } },
  });
  await prisma.weightLog.create({ data: { date: "2026-10-19", weightKg: 110.5, conditionsNote: "aç" } });
  await prisma.bodyMeasurement.create({ data: { date: "2026-10-19", waistCm: 104 } });
  await prisma.dailyWellbeing.create({ data: { date: "2026-10-19", energy1to5: 4, hunger1to5: 2, sleepMinutes: 400, stress1to5: 2 } });
  await prisma.supplementLog.create({ data: { date: "2026-10-19", name: "Kreatin Monohidrat", doseGrams: 5, taken: true } });
  await prisma.shoppingListItem.create({ data: { weekStart: "2026-10-19", category: "Diğer", name: "Granola", amount: 160, unit: "g", checked: true } });
  await prisma.pantryItem.create({ data: { name: "Yulaf", amount: 1, unit: "kg", expiryDate: "2026-12-01", notes: "dolap" } });
  await prisma.aISettings.create({ data: { id: "default-ai", providerType: "lmstudio", baseUrl: "http://127.0.0.1:1234/v1", modelName: "qwen" } });
  const draft = await prisma.actionDraft.create({
    data: { draftType: "food_log", proposedChanges: "{}", impactSummary: "x", approvalTokenHash: "h1", expiresAt: new Date("2026-10-20T00:00:00Z") },
  });
  await prisma.aIConversation.create({
    data: { title: "Sohbet", messages: { create: [{ role: "user", content: "selam" }, { role: "assistant", content: "öneri", draftId: draft.id }] } },
  });
  await prisma.uploadedFile.create({
    data: {
      originalName: "plan.txt", mimeType: "text/plain", sizeBytes: 10, hash: "abc", storagePath: "/x/plan.txt",
      artifacts: { create: [{ normalizedType: "meal_plan", structuredData: "{}", confidence: "high" }] },
    },
  });
  await prisma.auditEvent.create({ data: { actionType: "APPLY_DRAFT", entityType: "food_log", status: "SUCCESS" } });
  // F13: kalorili içecek kendi besin kaydıyla bağlı.
  const beerLog = await prisma.foodLog.create({
    data: { date: "2026-10-19", time: "20:00", mealType: "extra", name: "Bira (330 ml)", grams: 330, caloriesSnapshot: 143, proteinSnapshot: 1, carbsSnapshot: 13, fatSnapshot: 0 },
  });
  await prisma.drinkLog.create({ data: { date: "2026-10-19", time: "20:00", kind: "alcohol", name: "Bira", ml: 330, alcoholG: 13, kcal: 143, foodLogId: beerLog.id } });
  await prisma.drinkLog.create({ data: { date: "2026-10-19", time: "09:00", kind: "water", name: "Su", ml: 500 } });
  // F73: kullanıcının ölçüsü.
  await prisma.foodMeasure.create({ data: { foodItemId: food.id, name: "kase", grams: 60 } });
  // F27: kardiyo kaydı.
  await prisma.cardioLog.create({ data: { date: "2026-10-19", kind: "run", durationMin: 30, distanceKm: 5, avgHr: 150, kcal: 380 } });
  // F15: takviye listesi ve birimli günlük kayıt.
  await prisma.supplement.create({ data: { name: "D Vitamini", doseAmount: 1000, doseUnit: "IU", notes: "Kahvaltıyla" } });
  await prisma.supplementLog.create({ data: { date: "2026-10-19", name: "D Vitamini", doseGrams: 1000, doseUnit: "IU" } });
  // F83: hatırlatma.
  await prisma.reminder.create({ data: { kind: "water", title: "Su iç", time: "10:00", days: "12345", lastFiredOn: "2026-10-19" } });
  // F14: biten bir oruç; F76: Ramazan ayarı profilde.
  await prisma.fastingSession.create({ data: { startedAt: new Date("2026-10-18T20:00:00Z"), endedAt: new Date("2026-10-19T12:00:00Z"), targetHours: 16 } });
  // F16: genişletilmiş ölçü (fotoğraf kayıtları yedeğe girmez).
  await prisma.bodyMeasurement.create({ data: { date: "2026-10-18", waistCm: 99, hipCm: 105, restingHr: 60, systolic: 120, diastolic: 80, notes: "Sabah" } });
  // F49: haftalık değerlendirme.
  await prisma.weeklyCheckin.create({
    data: { weekStart: "2026-10-12", metrics: JSON.stringify({ loggedDays: 6 }), summary: "İyi hafta.", aiGenerated: true, suggestion: JSON.stringify({ kind: "keep", text: "Devam" }) },
  });
  // F01: kayıtlı öğün, katalog gıdasına bağlı kalemiyle.
  await prisma.savedMeal.create({
    data: {
      name: "Sabah kasesi",
      mealType: "breakfast",
      items: { create: [{ foodItemId: food.id, name: "Granola", grams: 60, caloriesSnapshot: 270, proteinSnapshot: 6, carbsSnapshot: 36, fatSnapshot: 9 }] },
    },
  });
}

async function snapshot() {
  const out: Record<string, unknown[]> = {};
  for (const name of Object.values(Prisma.ModelName)) {
    if ((EXCLUDED_TABLES as readonly string[]).includes(name)) continue;
    const rows = await (prisma as any)[delegateKey(name)].findMany({ orderBy: { id: "asc" } });
    out[name] = rows.map(({ updatedAt: _updatedAt, ...rest }: any) => rest);
  }
  return out;
}

describe("Yedek v2 — tam kapsam", () => {
  it("OpenFoodFacts önbelleği dışındaki TÜM tabloları dışa aktarır", async () => {
    const res = await callRoute(exportBackup);
    expect(res.status).toBe(200);
    expect(res.json.version).toBe("2.0");
    // Önbellek ve makineye özgü ayarlar (otomatik yedek klasörü) yedeğe girmez.
    const excluded = new Set<string>(EXCLUDED_TABLES);
    const expected = Object.values(Prisma.ModelName).filter((m) => !excluded.has(m)).map(delegateKey);
    expect(Object.keys(res.json.data).sort()).toEqual(expected.sort());
  });

  it("üretilen şema bilgisi (src/generated/datamodel.ts) istemcinin tüm modellerini ve ilişki/benzersiz alanlarını içerir", () => {
    expect(datamodel.models.map((m) => m.name).sort()).toEqual(Object.values(Prisma.ModelName).sort());
    const ingredient = datamodel.models.find((m) => m.name === "RecipeIngredient")!;
    expect(ingredient.fields.find((f) => f.name === "recipe")?.relationFromFields).toEqual(["recipeId"]);
    const food = datamodel.models.find((m) => m.name === "FoodItem")!;
    expect(food.fields.find((f) => f.name === "barcode")?.isUnique).toBe(true);
    expect(food.fields.find((f) => f.name === "id")?.isId).toBe(true);
    expect(food.fields.find((f) => f.name === "updatedAt")?.isUpdatedAt).toBe(true);
  });

  it("gidiş-dönüş tüm tablo ve alanları kayıpsız geri yükler (brand, barcode, tags, isCompleted, createdAt...)", async () => {
    await seedRichData();
    const before = await snapshot();
    const backup = (await callRoute(exportBackup)).json;

    await resetDatabase();
    const res = await callRoute(importBackup, { body: backup });
    expect(res.status).toBe(200);

    const after = await snapshot();
    // AI bağlantısı yedekten geldiği için yeniden test edilene kadar "untested" sayılır.
    (before.AISettings as any[])[0].connectionStatus = "untested";
    expect(after).toEqual(before);
  });

  it("aynı yedek iki kez içe aktarılınca kopya oluşmaz", async () => {
    await seedRichData();
    const backup = (await callRoute(exportBackup)).json;
    await callRoute(importBackup, { body: backup });
    await callRoute(importBackup, { body: backup });
    expect(await prisma.foodLog.count()).toBe(2); // öğün + biranın kalori kaydı
    expect(await prisma.drinkLog.count()).toBe(2);
    expect(await prisma.setLog.count()).toBe(1);
    expect(await prisma.aIMessage.count()).toBe(2);
  });
});

describe("Yedek v2 — dayanıklılık", () => {
  it("binlerce satırı zaman aşımına düşmeden geri yükler", async () => {
    const foodLog = Array.from({ length: 4000 }, (_, i) => ({
      id: `fl${i}`, date: "2026-01-01", time: "12:00", mealType: "lunch", name: `Öğün ${i}`, grams: 100,
      caloriesSnapshot: 100, proteinSnapshot: 10, carbsSnapshot: 10, fatSnapshot: 2, createdAt: "2026-01-01T12:00:00.000Z",
    }));
    const workoutSession = Array.from({ length: 300 }, (_, i) => ({ id: `ws${i}`, date: "2026-01-01", name: `S${i}`, durationMinutes: 40, completed: true }));
    const setLog = workoutSession.flatMap((s, i) =>
      Array.from({ length: 10 }, (_, j) => ({ id: `sl${i}_${j}`, workoutSessionId: s.id, exerciseName: "Bench", setNumber: j + 1, weightKg: 60, reps: 8, isTargetMet: false }))
    );

    const started = Date.now();
    const res = await callRoute(importBackup, { body: { version: "2.0", data: { foodLog, workoutSession, setLog } } });
    const elapsed = Date.now() - started;

    expect(res.status).toBe(200);
    expect(await prisma.foodLog.count()).toBe(4000);
    expect(await prisma.setLog.count()).toBe(3000);
    expect(elapsed).toBeLessThan(15_000);
  }, 30_000);

  it("bozuk bir satır tablo ve satır numarasıyla 400 döner; hiçbir şey yazılmaz", async () => {
    const res = await callRoute(importBackup, {
      body: {
        version: "2.0",
        data: {
          foodItem: [{ id: "f1", name: "Elma", calories: 52, proteinG: 0.3, carbsG: 14, fatG: 0.2 }],
          foodLog: [{ id: "x", date: "2026-01-01", time: "12:00", mealType: "lunch", name: "A", grams: 100, caloriesSnapshot: "çok", proteinSnapshot: 1, carbsSnapshot: 1, fatSnapshot: 1 }],
        },
      },
    });
    expect(res.status).toBe(400);
    expect(res.json.error).toContain("foodLog");
    expect(res.json.error).toContain("caloriesSnapshot");
    expect(await prisma.foodItem.count()).toBe(0);
  });

  it("aynı tarihte yerel kayıt varsa onu günceller ve alt kayıtları ona bağlar", async () => {
    const local = await prisma.mealPlan.create({ data: { date: "2026-10-19", notes: "yerel" } });
    await prisma.weightLog.create({ data: { id: "local-w", date: "2026-10-19", weightKg: 100 } });

    const res = await callRoute(importBackup, {
      body: {
        version: "2.0",
        data: {
          mealPlan: [{ id: "backup-plan", date: "2026-10-19", notes: "yedek" }],
          plannedMeal: [{ id: "pm1", mealPlanId: "backup-plan", mealType: "lunch", customName: "Mercimek", servings: 1, isCompleted: false }],
          weightLog: [{ id: "backup-w", date: "2026-10-19", weightKg: 99 }],
        },
      },
    });
    expect(res.status).toBe(200);
    const plans = await prisma.mealPlan.findMany({ include: { meals: true } });
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ id: local.id, notes: "yedek" });
    expect(plans[0].meals.map((m) => m.customName)).toEqual(["Mercimek"]);
    expect(await prisma.weightLog.findMany()).toEqual([expect.objectContaining({ date: "2026-10-19", weightKg: 99 })]);
  });

  it("farklı kimlikli profil ikinci bir profil oluşturmaz", async () => {
    await prisma.userProfile.create({ data: { id: "default-user", heightCm: 170 } });
    await callRoute(importBackup, { body: { version: "2.0", data: { userProfile: [{ id: "baska-id", heightCm: 181, age: 30 }] } } });
    const profiles = await prisma.userProfile.findMany();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({ id: "default-user", heightCm: 181, age: 30 });
  });

  it("geri yüklenen tarifin malzemeleri yedektekiyle aynı olur (yereldeki fazla malzeme kalkar)", async () => {
    const a = await prisma.foodItem.create({ data: { id: "fa", name: "A", calories: 1, proteinG: 1, carbsG: 1, fatG: 1 } });
    const b = await prisma.foodItem.create({ data: { id: "fb", name: "B", calories: 1, proteinG: 1, carbsG: 1, fatG: 1 } });
    await prisma.recipe.create({ data: { id: "r1", name: "Tarif", ingredients: { create: [{ id: "ia", foodItemId: a.id, grams: 50 }, { id: "ib", foodItemId: b.id, grams: 50 }] } } });

    await callRoute(importBackup, {
      body: { version: "2.0", data: { recipe: [{ id: "r1", name: "Tarif" }], recipeIngredient: [{ id: "ia", recipeId: "r1", foodItemId: "fa", grams: 70 }] } },
    });
    const ings = await prisma.recipeIngredient.findMany({ where: { recipeId: "r1" } });
    expect(ings.map((i) => [i.foodItemId, i.grams])).toEqual([["fa", 70]]);
  });
});
