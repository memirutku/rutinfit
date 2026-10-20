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

/** Taslak işlemlerinde HTTP durum koduna eşlenen tipli hata. */
export class DraftActionError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 410,
    readonly code: 'not_found' | 'bad_token' | 'expired' | 'not_pending' | 'conflict' | 'invalid'
  ) {
    super(message);
    this.name = 'DraftActionError';
  }
}

function tokenMatchesHash(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashApprovalToken(token), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function findDraftOrThrow(draftId: string) {
  const draft = await prisma.actionDraft.findUnique({ where: { id: draftId } });
  if (!draft) throw new DraftActionError('Taslak bulunamadı.', 404, 'not_found');
  return draft;
}

function assertPendingAndFresh(draft: { status: string; expiresAt: Date }) {
  if (draft.status !== 'pending') {
    throw new DraftActionError(`Taslak "${draft.status}" durumunda olduğu için bu işlem yapılamaz.`, 409, 'not_pending');
  }
  if (new Date() > draft.expiresAt) {
    throw new DraftActionError('Taslağın onay süresi doldu. Lütfen koçtan yeni bir öneri isteyin.', 410, 'expired');
  }
}

/**
 * Bekleyen bir taslak için yeni onay anahtarı üretir (eski anahtar geçersizleşir).
 * Ham anahtar hiçbir yerde saklanmaz; geçmiş sohbetteki öneriyi onaylamak için kullanılır.
 */
export async function reissueApprovalToken(draftId: string) {
  const draft = await findDraftOrThrow(draftId);
  assertPendingAndFresh(draft);

  const rawApprovalToken = crypto.randomBytes(24).toString('hex');
  const res = await prisma.actionDraft.updateMany({
    where: { id: draftId, status: 'pending' },
    data: { approvalTokenHash: hashApprovalToken(rawApprovalToken) },
  });
  if (res.count !== 1) throw new DraftActionError('Taslak bu sırada değişti.', 409, 'conflict');

  return { draftId, approvalToken: rawApprovalToken, expiresAt: draft.expiresAt };
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
  const draft = await findDraftOrThrow(draftId);

  const alreadyApplied = {
    success: true,
    alreadyApplied: true,
    message: 'Bu taslak daha önce başarıyla onaylanmış ve uygulanmıştır.',
    draftId: draft.id,
  };
  if (draft.status === 'applied') return alreadyApplied;

  assertPendingAndFresh(draft);

  if (!approvalToken || !tokenMatchesHash(approvalToken, draft.approvalTokenHash)) {
    throw new DraftActionError('Geçersiz onay anahtarı. Yetkisiz veya sahte işlem engellendi.', 403, 'bad_token');
  }

  if (draft.draftType === 'bulk_import') {
    // Toplu içe aktarma henüz veri yazmıyor; "uygulandı" demek kullanıcıyı yanıltır.
    throw new DraftActionError(
      'Toplu içe aktarma taslakları henüz onaylanamıyor. Dosyayı ilgili sayfadan içe aktarın.',
      400,
      'invalid'
    );
  }

  // Düzenleme yalnız değiştirilen alanları günceller; taslağın geri kalanı korunur.
  const storedChanges = JSON.parse(draft.proposedChanges || '{}');
  const rawChanges = editedChanges ? { ...storedChanges, ...editedChanges } : storedChanges;
  const changesToApply = validateDraftChanges(draft.draftType as DraftType, rawChanges);
  let affectedEntityId: string | undefined;
  let claimed = false;

  // Mutasyon transaction içinde: taslak önce atomik olarak "applied"a çekilir.
  // Aynı anda gelen ikinci onay 0 satır günceller ve hiçbir şey yazmaz.
  await prisma.$transaction(async (tx) => {
    const claim = await tx.actionDraft.updateMany({
      where: {
        id: draft.id,
        status: 'pending',
        approvalTokenHash: draft.approvalTokenHash,
        expiresAt: { gt: new Date() },
      },
      data: { status: 'applied', proposedChanges: JSON.stringify(changesToApply) },
    });
    if (claim.count !== 1) return;
    claimed = true;

    switch (draft.draftType) {
      case 'meal_plan': {
        const { date, meals, notes, replaceMeals } = changesToApply;
        const targetDate = date || getLocalDateString();

        const plan = await tx.mealPlan.upsert({
          where: { date: targetDate },
          create: { date: targetDate, notes: notes ?? null },
          update: notes !== undefined ? { notes } : {},
        });
        affectedEntityId = plan.id;

        if (Array.isArray(meals) && meals.length > 0) {
          if (replaceMeals) {
            await tx.plannedMeal.deleteMany({ where: { mealPlanId: plan.id } });
          }
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

      case 'planned_meal': {
        const { date, mealType, title, rationale, prepMinutes, ingredients } = changesToApply;
        const targetDate = date || getLocalDateString();
        const matched = (ingredients as Array<{ foodItemId?: string | null; grams: number }>).filter(
          (i) => !!i.foodItemId
        );

        // Katalogla eşleşen malzemelerden tarif kurulur: plan makroları ve alışveriş listesi buradan beslenir.
        const recipe =
          matched.length > 0
            ? await tx.recipe.create({
                data: {
                  name: title,
                  instructions: rationale || '',
                  prepMinutes: prepMinutes || 15,
                  servings: 1,
                  ingredients: {
                    create: matched.map((i) => ({ foodItemId: i.foodItemId as string, grams: i.grams })),
                  },
                },
              })
            : null;

        const plan = await tx.mealPlan.upsert({
          where: { date: targetDate },
          create: { date: targetDate },
          update: {},
        });
        const planned = await tx.plannedMeal.create({
          data: {
            mealPlanId: plan.id,
            mealType: mealType || 'dinner',
            recipeId: recipe?.id ?? null,
            customName: title,
            servings: 1,
          },
        });
        affectedEntityId = planned.id;
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
        const targets = {
          calorieTarget,
          ...(calorieCeiling !== undefined && { calorieCeiling }),
          proteinTargetG,
          fatTargetG,
          carbTargetG,
        };
        const existing = await tx.userProfile.findFirst();
        const updated = existing
          ? await tx.userProfile.update({ where: { id: existing.id }, data: targets })
          : await tx.userProfile.create({ data: { id: 'default-user', ...targets } });
        affectedEntityId = updated.id;
        break;
      }

      case 'workout_session': {
        const { date, name, durationMinutes, rpe, sets, completed } = changesToApply;
        const targetDate = date || getLocalDateString();
        const session = await tx.workoutSession.create({
          data: {
            date: targetDate,
            name: name || 'Antrenman Seansı',
            durationMinutes: Number(durationMinutes) || 45,
            rpe: rpe ? Math.min(10, Math.max(1, Math.round(Number(rpe)))) : null,
            // AI önerisi bir plandır: kullanıcı yapmadan "tamamlandı" sayılmaz.
            completed: completed === true,
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
                isTargetMet: false,
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

    }

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

  if (!claimed) {
    const current = await prisma.actionDraft.findUnique({ where: { id: draft.id } });
    if (current?.status === 'applied') return alreadyApplied;
    throw new DraftActionError('Taslak bu sırada değişti ve uygulanamadı.', 409, 'conflict');
  }

  return {
    success: true,
    draftId: draft.id,
    draftType: draft.draftType,
    entityId: affectedEntityId,
    message: 'Taslak başarıyla onaylandı ve veritabanına uygulandı.',
  };
}

export async function rejectActionDraft(draftId: string, reason?: string) {
  const draft = await findDraftOrThrow(draftId);
  if (draft.status === 'rejected') {
    return { success: true, draftId, status: 'rejected', message: 'Taslak zaten iptal edilmiş.' };
  }

  const res = await prisma.actionDraft.updateMany({
    where: { id: draftId, status: 'pending' },
    data: { status: 'rejected' },
  });
  if (res.count !== 1) {
    throw new DraftActionError(`Taslak "${draft.status}" durumunda olduğu için reddedilemez.`, 409, 'not_pending');
  }

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
