import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as chat } from "@/app/api/ai/chat/route";
import { POST as actions } from "@/app/api/ai/actions/route";
import { prisma } from "@/lib/prisma";
import { createActionDraft } from "@/lib/ai-tools/action-tools";
import { calculateRecipeNutrition } from "@/lib/ai-tools/draft-tools";
import { getLocalDateString } from "@/lib/date-utils";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createFood, createMealPlan, createProfile } from "../helpers/factories";
import { startMockLLMServer, withActionBlock, type MockLLMServer } from "../helpers/mock-llm-server";

let llm: MockLLMServer;
beforeAll(async () => {
  llm = await startMockLLMServer();
});
afterAll(async () => {
  await llm.close();
});
beforeEach(async () => {
  await resetDatabase();
  await prisma.aISettings.create({ data: { id: "default-ai", baseUrl: llm.baseUrl, modelName: "mock-llama" } });
});

const approve = (draftId: string, approvalToken: string, editedChanges?: Record<string, unknown>) =>
  callRoute(actions, { body: { draftId, approvalToken, action: "approve", editedChanges } });

async function askCoach(action: unknown) {
  llm.queueReply(withActionBlock("Önerim:", action));
  const res = await callRoute(chat, { body: { messages: [{ role: "user", content: "öneri ver" }] } });
  expect(res.json.isError).toBe(false);
  return res.json.actionProposal;
}

const mealProposal = (ingredients: Array<{ foodName: string; grams: number }>) => ({
  type: "meal_proposal",
  mealType: "dinner",
  title: "Tavuklu Bulgur",
  rationale: "Protein açığı",
  prepMinutes: 20,
  ingredients,
  estimatedMacros: { calories: 999, proteinG: 99, carbsG: 99, fatG: 99 }, // modelin uydurması
});

describe("AI öğün önerisi → plan", () => {
  it("onaylanınca bugünün planına tarifli öğün olarak eklenir, 'yendi' kaydı oluşmaz", async () => {
    await createFood({ name: "Tavuk Göğsü", calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 });
    await createFood({ name: "Pilavlık Bulgur", calories: 350, proteinG: 12, carbsG: 70, fatG: 1.5 });
    const proposal = await askCoach(mealProposal([
      { foodName: "Tavuk Göğsü", grams: 150 },
      { foodName: "Pilavlık Bulgur", grams: 60 },
    ]));

    // Kart deterministik makroyu taşır (modelin 999 kcal tahmini değil)
    expect(proposal.deterministicMacros.totalCalories).toBe(458); // 247.5 + 210
    const res = await approve(proposal.draftId, proposal.approvalToken);
    expect(res.status).toBe(200);

    expect(await prisma.foodLog.count()).toBe(0);
    const plan = await prisma.mealPlan.findUniqueOrThrow({
      where: { date: getLocalDateString() },
      include: { meals: { include: { recipe: { include: { ingredients: true } } } } },
    });
    expect(plan.meals).toHaveLength(1);
    expect(plan.meals[0]).toMatchObject({ mealType: "dinner", customName: "Tavuklu Bulgur" });
    expect(plan.meals[0].recipe?.ingredients.map((i) => i.grams).sort()).toEqual([150, 60]);
  });

  it("mevcut plan öğünlerini silmez, ekler", async () => {
    await createFood({ name: "Tavuk Göğsü" });
    await createMealPlan(getLocalDateString(), [{ mealType: "breakfast", customName: "Yulaf" }]);
    const proposal = await askCoach(mealProposal([{ foodName: "Tavuk Göğsü", grams: 150 }]));
    await approve(proposal.draftId, proposal.approvalToken);
    const meals = await prisma.plannedMeal.findMany();
    expect(meals.map((m) => m.customName).sort()).toEqual(["Tavuklu Bulgur", "Yulaf"]);
  });

  it("katalogda bulunmayan malzemeyi sessizce 0 saymaz: uyarı ve eksik listesi döner", async () => {
    await createFood({ name: "Tavuk Göğsü", calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 });
    const proposal = await askCoach(mealProposal([
      { foodName: "Tavuk Göğsü", grams: 100 },
      { foodName: "Ejder Meyvesi", grams: 100 },
    ]));
    expect(proposal.deterministicMacros.missingIngredients).toEqual(["Ejder Meyvesi"]);
    const draft = await prisma.actionDraft.findUniqueOrThrow({ where: { id: proposal.draftId } });
    expect(draft.impactSummary).toContain("Ejder Meyvesi");
  });
});

describe("Malzeme eşleştirme", () => {
  it("tam ad eşleşmesini 'içerir' eşleşmesine tercih eder (Yulaf ≠ Yulaf Sütü)", async () => {
    await createFood({ name: "Yulaf Sütü", calories: 45 });
    await createFood({ name: "Yulaf", calories: 380 });
    const r = await calculateRecipeNutrition([{ name: "yulaf", grams: 100 }]);
    expect(r.totalCalories).toBe(380);
  });

  it("'Yağ' kelimesi 'Yağsız Yoğurt'a eşlenmez", async () => {
    await createFood({ name: "Yağsız Yoğurt", calories: 40 });
    const r = await calculateRecipeNutrition([{ name: "Yağ", grams: 10 }]);
    expect(r.itemized[0].foundInDb).toBe(false);
  });
});

describe("AI antrenman önerisi", () => {
  it("önerilen set sayısı kadar set yazar; 'tamamlandı' ve 'hedef tuttu' saymaz", async () => {
    const proposal = await askCoach({
      type: "workout_adjustment",
      title: "25 dk Kısa Seans",
      targetDurationMinutes: 25,
      reason: "Yorgunluk",
      exercises: [
        { exerciseName: "Squat", sets: 3, repMin: 8, repMax: 10, restSeconds: 90 },
        { exerciseName: "Row", sets: 2, repMin: 10, repMax: 12, restSeconds: 60 },
      ],
    });
    await approve(proposal.draftId, proposal.approvalToken);

    const session = await prisma.workoutSession.findFirstOrThrow({ include: { setLogs: true } });
    expect(session.completed).toBe(false);
    expect(session.setLogs).toHaveLength(5);
    expect(session.setLogs.every((s) => !s.isTargetMet)).toBe(true);
    expect(session.setLogs.filter((s) => s.exerciseName === "Squat").map((s) => s.setNumber).sort()).toEqual([1, 2, 3]);
  });
});

describe("Taslak düzenleme ve diğer türler", () => {
  it("düzenleme yalnız değiştirilen alanı günceller, setler korunur", async () => {
    const d = await createActionDraft({
      draftType: "workout_session",
      proposedChanges: { name: "Eski Ad", durationMinutes: 30, sets: [{ exerciseName: "Bench", reps: 8, weightKg: 60, rpe: 7.5 }] },
      impactSummary: "x",
    });
    await approve(d.draftId, d.approvalToken, { name: "Yeni Ad" });
    const session = await prisma.workoutSession.findFirstOrThrow({ include: { setLogs: true } });
    expect(session.name).toBe("Yeni Ad");
    expect(session.setLogs).toHaveLength(1);
    expect(session.setLogs[0].weightKg).toBe(60);
    expect(session.setLogs[0].rpe).toBe(7.5);
  });

  it("yalnız not içeren meal_plan taslağı günün öğünlerini silmez", async () => {
    await createMealPlan("2026-10-19", [{ mealType: "lunch", customName: "Mercimek" }]);
    const d = await createActionDraft({ draftType: "meal_plan", proposedChanges: { date: "2026-10-19", notes: "Su iç" }, impactSummary: "x" });
    await approve(d.draftId, d.approvalToken);
    const plan = await prisma.mealPlan.findUniqueOrThrow({ where: { date: "2026-10-19" }, include: { meals: true } });
    expect(plan.notes).toBe("Su iç");
    expect(plan.meals).toHaveLength(1);
  });

  it("bulk_import veri yazmadan 'uygulandı' sayılmaz: 400 ve taslak bekler", async () => {
    const d = await createActionDraft({ draftType: "bulk_import", proposedChanges: { itemsCount: 3 }, impactSummary: "x" });
    const res = await approve(d.draftId, d.approvalToken);
    expect(res.status).toBe(400);
    expect((await prisma.actionDraft.findUniqueOrThrow({ where: { id: d.draftId } })).status).toBe("pending");
  });

  it("beslenme hedefi taslağı profil yoksa oluşturur, sıfır yağ hedefini yok saymaz", async () => {
    const d = await createActionDraft({
      draftType: "nutrition_targets",
      proposedChanges: { calorieTarget: 1900, calorieCeiling: 2000, proteinTargetG: 150, fatTargetG: 0, carbTargetG: 200 },
      impactSummary: "x",
    });
    await approve(d.draftId, d.approvalToken);
    const p = await prisma.userProfile.findUniqueOrThrow({ where: { id: "default-user" } });
    expect(p).toMatchObject({ calorieTarget: 1900, calorieCeiling: 2000, proteinTargetG: 150, fatTargetG: 0 });
  });

  it("kesirli hedefleri tam sayıya yuvarlar (Int sütun)", async () => {
    await createProfile();
    const d = await createActionDraft({
      draftType: "nutrition_targets",
      proposedChanges: { calorieTarget: 1950.6, proteinTargetG: 150.4, fatTargetG: 55.5, carbTargetG: 200 },
      impactSummary: "x",
    });
    const res = await approve(d.draftId, d.approvalToken);
    expect(res.status).toBe(200);
    expect(await prisma.userProfile.findUniqueOrThrow({ where: { id: "default-user" } })).toMatchObject({
      calorieTarget: 1951,
      proteinTargetG: 150,
      fatTargetG: 56,
    });
  });
});
