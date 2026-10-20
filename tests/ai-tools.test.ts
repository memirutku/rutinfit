import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase } from './helpers/db';
import { createFood } from './helpers/factories';
import { prisma } from '../src/lib/prisma';
import {
  createActionDraft,
  verifyAndApplyActionDraft,
  rejectActionDraft,
  calculateRecipeNutrition,
  draftShoppingListDelta,
} from '../src/lib/ai-tools';

describe('AI Tools & Action Draft Engine', () => {
  beforeEach(resetDatabase);

  it('should create an ActionDraft with approval token and hash', async () => {
    const draft = await createActionDraft({
      draftType: 'food_log',
      proposedChanges: {
        date: '2026-10-18',
        name: 'TEST_Yulaf',
        grams: 60,
        calories: 220,
        proteinG: 8,
        carbsG: 38,
        fatG: 4,
      },
      impactSummary: 'TEST_ Yulaf ezmesi öğünü (220 kcal)',
    });

    expect(draft.draftId).toBeDefined();
    expect(draft.approvalToken).toBeDefined();
    expect(draft.approvalToken.length).toBeGreaterThan(16);
    expect(draft.draftType).toBe('food_log');

    const dbRecord = await prisma.actionDraft.findUnique({
      where: { id: draft.draftId },
    });
    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.status).toBe('pending');
  });

  it('should reject invalid or tampered approval token', async () => {
    const draft = await createActionDraft({
      draftType: 'food_log',
      proposedChanges: {
        date: '2026-10-18',
        name: 'TEST_Hileli_Islem',
        grams: 100,
        calories: 100,
      },
      impactSummary: 'TEST_ Guvenlik kontrolu',
    });

    await expect(
      verifyAndApplyActionDraft(draft.draftId, 'wrong-fake-token-1234')
    ).rejects.toThrow('Geçersiz onay anahtarı');
  });

  it('should apply valid draft to database and record audit event', async () => {
    const draft = await createActionDraft({
      draftType: 'food_log',
      proposedChanges: {
        date: '2026-10-18',
        time: '08:30',
        mealType: 'breakfast',
        name: 'TEST_Omlet',
        grams: 150,
        calories: 280,
        proteinG: 22,
        carbsG: 2,
        fatG: 20,
      },
      impactSummary: 'TEST_ Kahvaltı omleti',
    });

    const result = await verifyAndApplyActionDraft(draft.draftId, draft.approvalToken);
    expect(result.success).toBe(true);
    expect(result.draftId).toBe(draft.draftId);

    // Verify draft status in DB
    const updatedDraft = await prisma.actionDraft.findUnique({
      where: { id: draft.draftId },
    });
    expect(updatedDraft?.status).toBe('applied');

    // Verify FoodLog entry created
    const createdLog = await prisma.foodLog.findFirst({
      where: { name: 'TEST_Omlet' },
    });
    expect(createdLog).not.toBeNull();
    expect(createdLog?.caloriesSnapshot).toBe(280);

    // Verify AuditEvent
    const audit = await prisma.auditEvent.findFirst({
      where: { details: { contains: draft.draftId } },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actionType).toBe('APPLY_DRAFT');

  });

  it('should handle draft rejection gracefully', async () => {
    const draft = await createActionDraft({
      draftType: 'meal_plan',
      proposedChanges: { date: '2026-10-18' },
      impactSummary: 'TEST_ Iptal denemesi',
    });

    const rejection = await rejectActionDraft(draft.draftId, 'Kullanıcı vazgeçti');
    expect(rejection.success).toBe(true);
    expect(rejection.status).toBe('rejected');

    const updated = await prisma.actionDraft.findUnique({
      where: { id: draft.draftId },
    });
    expect(updated?.status).toBe('rejected');
  });

  it('should deterministically calculate recipe ingredients with nutrition calculator', async () => {
    await createFood({ name: 'Yumurta', basisGrams: 100, calories: 155, proteinG: 13, carbsG: 1.1, fatG: 11 });
    await createFood({ name: 'Yulaf', basisGrams: 100, calories: 380, proteinG: 13, carbsG: 60, fatG: 7 });

    const result = await calculateRecipeNutrition([
      { name: 'Yumurta', grams: 100 },
      { name: 'Yulaf', grams: 50 },
    ]);

    expect(result.totalCalories).toBe(345); // 155 + 190
    expect(result.totalProteinG).toBe(19.5); // 13 + 6.5
    expect(result.totalCarbsG).toBe(31.1);
    expect(result.totalFatG).toBe(14.5);
    expect(result.itemized.every((i: any) => i.foundInDb)).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('should warn and contribute zero for an ingredient missing from the catalog', async () => {
    const result = await calculateRecipeNutrition([{ name: 'Olmayan Besin', grams: 100 }]);
    expect(result.totalCalories).toBe(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.itemized[0].foundInDb).toBe(false);
  });

  it('should compute shopping list delta accurately', async () => {
    const delta = await draftShoppingListDelta([
      { name: 'Somon Balığı Test', amount: 400, unit: 'g', category: 'Kasap/Balık' },
      { name: 'Kuşkonmaz Test', amount: 200, unit: 'g', category: 'Manav' },
    ]);

    expect(delta.totalPlanned).toBe(2);
    // Kiler ve alışveriş listesi boş: iki malzemenin ikisi de eklenecek.
    expect(delta.coveredByPantry).toBe(0);
    expect(delta.newItemsToAdd.map((i) => i.name)).toEqual(['Somon Balığı Test', 'Kuşkonmaz Test']);
    expect(delta.newItemsToAdd[0].amount).toBe(400);
    expect(delta.impactSummary).toContain('Alışveriş listesine');
  });

  it('should reject creating draft when proposed changes fail schema validation', async () => {
    await expect(
      createActionDraft({
        draftType: 'food_log',
        proposedChanges: {
          name: 'Hatalı Besin',
          grams: -50, // Geçersiz negatif gram
        },
        impactSummary: 'TEST_ Gecersiz gram',
      })
    ).rejects.toThrow();
  });

  it('should reject applying draft when edited changes fail schema validation', async () => {
    const draft = await createActionDraft({
      draftType: 'workout_session',
      proposedChanges: {
        name: 'TEST_Gecerli_Seans',
        durationMinutes: 45,
        sets: [{ exerciseName: 'Barbell Row', weightKg: 50, reps: 10 }],
      },
      impactSummary: 'TEST_ Gecerli seans',
    });

    // Attempt to apply with invalid edited changes (empty name)
    await expect(
      verifyAndApplyActionDraft(draft.draftId, draft.approvalToken, {
        name: '', // Invalid empty string
        sets: [],
      })
    ).rejects.toThrow();
  });
});

