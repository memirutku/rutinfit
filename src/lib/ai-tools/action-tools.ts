import crypto from 'crypto';
import { prisma } from '../prisma';
import { getLocalDateString } from '../date-utils';
import { DraftType, validateDraftChanges } from '../ai-schema';

export interface CreateDraftParams {
  draftType: DraftType;
  proposedChanges: Record<string, any>;
  impactSummary: string;
  ttlMinutes?: number;
}

export function hashApprovalToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createActionDraft(params: CreateDraftParams) {
  const { draftType, proposedChanges, impactSummary, ttlMinutes = 120 } = params;

  // Validate proposed changes against schema before saving draft
  const validatedChanges = validateDraftChanges(draftType, proposedChanges);

  const rawApprovalToken = crypto.randomBytes(24).toString('hex');
  const approvalTokenHash = hashApprovalToken(rawApprovalToken);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  const draft = await prisma.actionDraft.create({
    data: {
      draftType,
      proposedChanges: JSON.stringify(validatedChanges),
      impactSummary,
      status: 'pending',
      approvalTokenHash,
      expiresAt,
    },
  });

  return {
    draftId: draft.id,
    approvalToken: rawApprovalToken,
    draftType: draft.draftType,
    impactSummary: draft.impactSummary,
    proposedChanges: validatedChanges,
    expiresAt: draft.expiresAt,
  };
}

export async function verifyAndApplyActionDraft(
  draftId: string,
  approvalToken: string,
  editedChanges?: Record<string, any>
) {
  const draft = await prisma.actionDraft.findUnique({
    where: { id: draftId },
  });

  if (!draft) {
    throw new Error(`Taslak (${draftId}) bulunamadı.`);
  }

  if (draft.status === 'applied') {
    return {
      success: true,
      alreadyApplied: true,
      message: 'Bu taslak daha önce başarıyla onaylanmış ve uygulanmıştır.',
      draftId: draft.id,
    };
  }

  if (draft.status !== 'pending') {
    throw new Error(`Taslak durumu "${draft.status}" olduğu için uygulanamaz.`);
  }

  if (new Date() > draft.expiresAt) {
    throw new Error('Taslağın onay süresi doldu. Lütfen yeni bir taslak oluşturun.');
  }

  // Token verification
  const computedHash = hashApprovalToken(approvalToken);
  if (computedHash !== draft.approvalTokenHash) {
    throw new Error('Geçersiz onay anahtarı (approvalToken). Yetkisiz veya sahte işlem engellendi.');
  }

  const rawChanges = editedChanges || JSON.parse(draft.proposedChanges || '{}');
  const changesToApply = validateDraftChanges(draft.draftType as DraftType, rawChanges);
  let affectedEntityId: string | undefined;

  // Execute mutation safely inside transaction
  await prisma.$transaction(async (tx) => {
    switch (draft.draftType) {
      case 'meal_plan': {
        const { date, meals, notes } = changesToApply;
        const targetDate = date || getLocalDateString();

        // Upsert meal plan
        const plan = await tx.mealPlan.upsert({
          where: { date: targetDate },
          create: { date: targetDate, notes },
          update: { notes },
        });
        affectedEntityId = plan.id;

        if (Array.isArray(meals)) {
          // Replace or append planned meals
          await tx.plannedMeal.deleteMany({ where: { mealPlanId: plan.id } });
          for (const m of meals) {
            await tx.plannedMeal.create({
              data: {
                mealPlanId: plan.id,
                mealType: m.mealType || 'snack',
                recipeId: m.recipeId || null,
                customName: m.customName || m.name || null,
                plannedTime: m.plannedTime || null,
                servings: m.servings || 1,
              },
            });
          }
        }
        break;
      }

      case 'food_log': {
        const { date, time, mealType, name, grams, calories, proteinG, carbsG, fatG } = changesToApply;
        const targetDate = date || getLocalDateString();
        const log = await tx.foodLog.create({
          data: {
            date: targetDate,
            time: time || '12:00',
            mealType: mealType || 'extra',
            name: name || 'Öğün Kaydı',
            grams: Number(grams) || 100,
            caloriesSnapshot: Number(calories) || 0,
            proteinSnapshot: Number(proteinG) || 0,
            carbsSnapshot: Number(carbsG) || 0,
            fatSnapshot: Number(fatG) || 0,
          },
        });
        affectedEntityId = log.id;
        break;
      }

      case 'recipe': {
        const { name, instructions, prepMinutes, servings, ingredients } = changesToApply;
        const recipe = await tx.recipe.create({
          data: {
            name: name || 'Yeni Tarif',
            instructions: instructions || '',
            prepMinutes: Number(prepMinutes) || 15,
            servings: Number(servings) || 1,
          },
        });
        affectedEntityId = recipe.id;

        if (Array.isArray(ingredients)) {
          for (const ing of ingredients) {
            if (ing.foodItemId) {
              await tx.recipeIngredient.create({
                data: {
                  recipeId: recipe.id,
                  foodItemId: ing.foodItemId,
                  grams: Number(ing.grams) || 100,
                },
              });
            }
          }
        }
        break;
      }

      case 'nutrition_targets': {
        const { calorieTarget, calorieCeiling, proteinTargetG, fatTargetG, carbTargetG } = changesToApply;
        const profile = await tx.userProfile.findFirst();
        if (profile) {
          const updated = await tx.userProfile.update({
            where: { id: profile.id },
            data: {
              calorieTarget: Number(calorieTarget) || profile.calorieTarget,
              calorieCeiling: Number(calorieCeiling) || profile.calorieCeiling,
              proteinTargetG: Number(proteinTargetG) || profile.proteinTargetG,
              fatTargetG: Number(fatTargetG) || profile.fatTargetG,
              carbTargetG: Number(carbTargetG) || profile.carbTargetG,
            },
          });
          affectedEntityId = updated.id;
        }
        break;
      }

      case 'workout_session': {
        const { date, name, durationMinutes, rpe, sets } = changesToApply;
        const targetDate = date || getLocalDateString();
        const session = await tx.workoutSession.create({
          data: {
            date: targetDate,
            name: name || 'Antrenman Seansı',
            durationMinutes: Number(durationMinutes) || 45,
            rpe: rpe ? Number(rpe) : null,
            completed: true,
          },
        });
        affectedEntityId = session.id;

        if (Array.isArray(sets)) {
          for (let i = 0; i < sets.length; i++) {
            const s = sets[i];
            await tx.setLog.create({
              data: {
                workoutSessionId: session.id,
                exerciseName: s.exerciseName || 'Egzersiz',
                setNumber: s.setNumber || i + 1,
                weightKg: Number(s.weightKg) || 0,
                reps: Number(s.reps) || 10,
                isTargetMet: true,
              },
            });
          }
        }
        break;
      }

      case 'weight_wellbeing': {
        const { date, weightKg, energy1to5, hunger1to5, sleepMinutes, stress1to5, notes } = changesToApply;
        const targetDate = date || getLocalDateString();

        if (weightKg !== undefined) {
          const wLog = await tx.weightLog.upsert({
            where: { date: targetDate },
            create: { date: targetDate, weightKg: Number(weightKg), conditionsNote: notes },
            update: { weightKg: Number(weightKg), conditionsNote: notes },
          });
          affectedEntityId = wLog.id;
        }

        if (energy1to5 !== undefined || sleepMinutes !== undefined) {
          await tx.dailyWellbeing.upsert({
            where: { date: targetDate },
            create: {
              date: targetDate,
              energy1to5: Number(energy1to5) || 3,
              hunger1to5: Number(hunger1to5) || 3,
              sleepMinutes: Number(sleepMinutes) || 420,
              stress1to5: Number(stress1to5) || 3,
              notes,
            },
            update: {
              energy1to5: energy1to5 !== undefined ? Number(energy1to5) : undefined,
              hunger1to5: hunger1to5 !== undefined ? Number(hunger1to5) : undefined,
              sleepMinutes: sleepMinutes !== undefined ? Number(sleepMinutes) : undefined,
              stress1to5: stress1to5 !== undefined ? Number(stress1to5) : undefined,
              notes: notes !== undefined ? notes : undefined,
            },
          });
        }
        break;
      }

      case 'bulk_import': {
        affectedEntityId = draft.id;
        break;
      }
    }

    // Mark draft as applied
    await tx.actionDraft.update({
      where: { id: draft.id },
      data: {
        status: 'applied',
        proposedChanges: JSON.stringify(changesToApply),
      },
    });

    // Record audit event
    await tx.auditEvent.create({
      data: {
        actionType: 'APPLY_DRAFT',
        entityType: draft.draftType,
        entityId: affectedEntityId || draft.id,
        status: 'SUCCESS',
        details: JSON.stringify({
          draftId: draft.id,
          appliedChanges: changesToApply,
        }),
      },
    });
  });

  return {
    success: true,
    draftId: draft.id,
    draftType: draft.draftType,
    entityId: affectedEntityId,
    message: 'Taslak başarıyla onaylandı ve veritabanına uygulandı.',
  };
}

export async function rejectActionDraft(draftId: string, reason?: string) {
  const draft = await prisma.actionDraft.findUnique({
    where: { id: draftId },
  });

  if (!draft) {
    throw new Error(`Taslak (${draftId}) bulunamadı.`);
  }

  await prisma.actionDraft.update({
    where: { id: draftId },
    data: { status: 'rejected' },
  });

  await prisma.auditEvent.create({
    data: {
      actionType: 'REJECT_DRAFT',
      entityType: draft.draftType,
      entityId: draft.id,
      status: 'SUCCESS',
      details: JSON.stringify({ draftId, reason: reason || 'Kullanıcı vazgeçti' }),
    },
  });

  return {
    success: true,
    draftId,
    status: 'rejected',
    message: 'Taslak iptal edildi.',
  };
}
