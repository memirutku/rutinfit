import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BackupEnvelopeSchema } from "@/lib/backup-schema";

export async function POST(req: Request) {
  try {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Geçersiz JSON formatı" },
        { status: 400 }
      );
    }

    const validationResult = BackupEnvelopeSchema.safeParse(json);
    if (!validationResult.success) {
      const issue = validationResult.error.issues[0];
      const errorMessage = issue?.message || "Geçersiz yedek dosyası formatı";
      return NextResponse.json(
        { error: errorMessage, details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { data } = validationResult.data;
    const counts: Record<string, number> = {};

    await prisma.$transaction(async (tx) => {
      // 1. Profil
      if (data.profile) {
        await tx.userProfile.upsert({
          where: { id: data.profile.id || "default-user" },
          update: {
            heightCm: data.profile.heightCm,
            age: data.profile.age,
            sex: data.profile.sex,
            currentWeightKg: data.profile.currentWeightKg,
            calorieTarget: data.profile.calorieTarget,
            calorieCeiling: data.profile.calorieCeiling,
            proteinTargetG: data.profile.proteinTargetG,
            fatTargetG: data.profile.fatTargetG,
            carbTargetG: data.profile.carbTargetG,
            wakeTime: data.profile.wakeTime,
            workdayHomeTime: data.profile.workdayHomeTime,
          },
          create: {
            id: data.profile.id || "default-user",
            heightCm: data.profile.heightCm,
            age: data.profile.age,
            sex: data.profile.sex,
            currentWeightKg: data.profile.currentWeightKg,
            calorieTarget: data.profile.calorieTarget,
            calorieCeiling: data.profile.calorieCeiling,
            proteinTargetG: data.profile.proteinTargetG,
            fatTargetG: data.profile.fatTargetG,
            carbTargetG: data.profile.carbTargetG,
            wakeTime: data.profile.wakeTime,
            workdayHomeTime: data.profile.workdayHomeTime,
          },
        });
        counts.profile = 1;
      }

      // 2. Besinler
      if (Array.isArray(data.foods)) {
        for (const f of data.foods) {
          await tx.foodItem.upsert({
            where: { id: f.id },
            update: {
              name: f.name,
              category: f.category,
              basisGrams: f.basisGrams,
              calories: f.calories,
              proteinG: f.proteinG,
              carbsG: f.carbsG,
              fatG: f.fatG,
              source: f.source,
              confidence: f.confidence,
            },
            create: {
              id: f.id,
              name: f.name,
              category: f.category,
              basisGrams: f.basisGrams,
              calories: f.calories,
              proteinG: f.proteinG,
              carbsG: f.carbsG,
              fatG: f.fatG,
              source: f.source,
              confidence: f.confidence,
            },
          });
        }
        counts.foods = data.foods.length;
      }

      // 3. Tarifler ve Malzemeleri
      if (Array.isArray(data.recipes)) {
        for (const r of data.recipes) {
          const recipe = await tx.recipe.upsert({
            where: { id: r.id },
            update: {
              name: r.name,
              instructions: r.instructions || "",
              prepMinutes: r.prepMinutes || 15,
              servings: r.servings || 1,
            },
            create: {
              id: r.id,
              name: r.name,
              instructions: r.instructions || "",
              prepMinutes: r.prepMinutes || 15,
              servings: r.servings || 1,
            },
          });

          if (Array.isArray(r.ingredients)) {
            await tx.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } });
            for (const ing of r.ingredients) {
              await tx.recipeIngredient.create({
                data: {
                  id: ing.id,
                  recipeId: recipe.id,
                  foodItemId: ing.foodItemId,
                  grams: ing.grams,
                },
              });
            }
          }
        }
        counts.recipes = data.recipes.length;
      }

      // 4. Yemek Planları ve Öğünler
      if (Array.isArray(data.mealPlans)) {
        for (const mp of data.mealPlans) {
          const plan = await tx.mealPlan.upsert({
            where: { date: mp.date },
            update: { notes: mp.notes },
            create: {
              id: mp.id,
              date: mp.date,
              notes: mp.notes,
            },
          });

          if (Array.isArray(mp.meals)) {
            await tx.plannedMeal.deleteMany({ where: { mealPlanId: plan.id } });
            for (const m of mp.meals) {
              await tx.plannedMeal.create({
                data: {
                  id: m.id,
                  mealPlanId: plan.id,
                  mealType: m.mealType,
                  recipeId: m.recipeId || null,
                  customName: m.customName || null,
                  plannedTime: m.plannedTime || null,
                  servings: m.servings || 1,
                },
              });
            }
          }
        }
        counts.mealPlans = data.mealPlans.length;
      }

      // 5. Besin Kayıtları (FoodLog)
      if (Array.isArray(data.foodLogs)) {
        for (const fl of data.foodLogs) {
          await tx.foodLog.upsert({
            where: { id: fl.id },
            update: {
              date: fl.date,
              time: fl.time,
              mealType: fl.mealType,
              foodItemId: fl.foodItemId || null,
              recipeId: fl.recipeId || null,
              name: fl.name,
              grams: fl.grams,
              caloriesSnapshot: fl.caloriesSnapshot,
              proteinSnapshot: fl.proteinSnapshot,
              carbsSnapshot: fl.carbsSnapshot,
              fatSnapshot: fl.fatSnapshot,
            },
            create: {
              id: fl.id,
              date: fl.date,
              time: fl.time,
              mealType: fl.mealType,
              foodItemId: fl.foodItemId || null,
              recipeId: fl.recipeId || null,
              name: fl.name,
              grams: fl.grams,
              caloriesSnapshot: fl.caloriesSnapshot,
              proteinSnapshot: fl.proteinSnapshot,
              carbsSnapshot: fl.carbsSnapshot,
              fatSnapshot: fl.fatSnapshot,
            },
          });
        }
        counts.foodLogs = data.foodLogs.length;
      }

      // 6. Antrenman Şablonları ve Egzersizleri
      if (Array.isArray(data.workoutTemplates)) {
        for (const wt of data.workoutTemplates) {
          const tpl = await tx.workoutTemplate.upsert({
            where: { id: wt.id },
            update: {
              name: wt.name,
              type: wt.type || "strength",
              dayOfWeek: wt.dayOfWeek,
              targetDurationMinutes: wt.targetDurationMinutes,
              notes: wt.notes || null,
            },
            create: {
              id: wt.id,
              name: wt.name,
              type: wt.type || "strength",
              dayOfWeek: wt.dayOfWeek,
              targetDurationMinutes: wt.targetDurationMinutes,
              notes: wt.notes || null,
            },
          });

          if (Array.isArray(wt.exercises)) {
            await tx.workoutExercise.deleteMany({ where: { templateId: tpl.id } });
            for (const ex of wt.exercises) {
              await tx.workoutExercise.create({
                data: {
                  id: ex.id,
                  templateId: tpl.id,
                  exerciseName: ex.exerciseName,
                  orderIndex: ex.orderIndex ?? ex.order ?? 0,
                  targetSets: ex.targetSets ?? 3,
                  repMin: ex.repMin ?? 8,
                  repMax: ex.repMax ?? 12,
                  restSeconds: ex.restSeconds ?? 90,
                },
              });
            }
          }
        }
        counts.workoutTemplates = data.workoutTemplates.length;
      }

      // 7. Antrenman Seansları ve Set Kayıtları
      if (Array.isArray(data.workoutSessions)) {
        for (const ws of data.workoutSessions) {
          const sess = await tx.workoutSession.upsert({
            where: { id: ws.id },
            update: {
              templateId: ws.templateId || null,
              date: ws.date,
              name: ws.name,
              durationMinutes: ws.durationMinutes,
              rpe: ws.rpe,
              notes: ws.notes,
              completed: ws.completed,
            },
            create: {
              id: ws.id,
              templateId: ws.templateId || null,
              date: ws.date,
              name: ws.name,
              durationMinutes: ws.durationMinutes,
              rpe: ws.rpe,
              notes: ws.notes,
              completed: ws.completed,
            },
          });

          if (Array.isArray(ws.setLogs)) {
            await tx.setLog.deleteMany({ where: { workoutSessionId: sess.id } });
            for (const s of ws.setLogs) {
              await tx.setLog.create({
                data: {
                  id: s.id,
                  workoutSessionId: sess.id,
                  exerciseName: s.exerciseName,
                  setNumber: s.setNumber,
                  weightKg: s.weightKg,
                  reps: s.reps,
                  isTargetMet: s.isTargetMet ?? false,
                },
              });
            }
          }
        }
        counts.workoutSessions = data.workoutSessions.length;
      }

      // 8. Kilo Kayıtları
      if (Array.isArray(data.weightLogs)) {
        for (const w of data.weightLogs) {
          await tx.weightLog.upsert({
            where: { date: w.date },
            update: { weightKg: w.weightKg, conditionsNote: w.conditionsNote },
            create: { date: w.date, weightKg: w.weightKg, conditionsNote: w.conditionsNote },
          });
        }
        counts.weightLogs = data.weightLogs.length;
      }

      // 9. Vücut Ölçümleri
      if (Array.isArray(data.measurements)) {
        for (const bm of data.measurements) {
          await tx.bodyMeasurement.upsert({
            where: { date: bm.date },
            update: {
              waistCm: bm.waistCm,
            },
            create: {
              id: bm.id,
              date: bm.date,
              waistCm: bm.waistCm,
            },
          });
        }
        counts.measurements = data.measurements.length;
      }

      // 10. İyilik Hali Kayıtları
      if (Array.isArray(data.wellbeings)) {
        for (const wb of data.wellbeings) {
          await tx.dailyWellbeing.upsert({
            where: { date: wb.date },
            update: {
              energy1to5: wb.energy1to5,
              hunger1to5: wb.hunger1to5,
              sleepMinutes: wb.sleepMinutes,
              stress1to5: wb.stress1to5,
              notes: wb.notes,
            },
            create: {
              date: wb.date,
              energy1to5: wb.energy1to5,
              hunger1to5: wb.hunger1to5,
              sleepMinutes: wb.sleepMinutes,
              stress1to5: wb.stress1to5,
              notes: wb.notes,
            },
          });
        }
        counts.wellbeings = data.wellbeings.length;
      }

      // 11. Takviye Kayıtları
      if (Array.isArray(data.supplementLogs)) {
        for (const sup of data.supplementLogs) {
          const suppName = sup.name || sup.supplementName || "Kreatin Monohidrat";
          await tx.supplementLog.upsert({
            where: {
              date_name: {
                date: sup.date,
                name: suppName,
              },
            },
            update: {
              doseGrams: sup.doseGrams ?? sup.dosage ?? 5.0,
              taken: sup.taken ?? true,
            },
            create: {
              id: sup.id,
              date: sup.date,
              name: suppName,
              doseGrams: sup.doseGrams ?? sup.dosage ?? 5.0,
              taken: sup.taken ?? true,
            },
          });
        }
        counts.supplementLogs = data.supplementLogs.length;
      }

      // 12. Alışveriş Listesi
      if (Array.isArray(data.shoppingListItems)) {
        for (const sli of data.shoppingListItems) {
          await tx.shoppingListItem.upsert({
            where: { id: sli.id },
            update: {
              weekStart: sli.weekStart,
              name: sli.name,
              amount: sli.amount,
              unit: sli.unit,
              category: sli.category,
              checked: sli.checked,
            },
            create: {
              id: sli.id,
              weekStart: sli.weekStart,
              name: sli.name,
              amount: sli.amount,
              unit: sli.unit,
              category: sli.category,
              checked: sli.checked,
            },
          });
        }
        counts.shoppingListItems = data.shoppingListItems.length;
      }

      // 13. Kiler Envanteri (PantryItem)
      if (Array.isArray(data.pantryItems)) {
        for (const pi of data.pantryItems) {
          await tx.pantryItem.upsert({
            where: { id: pi.id },
            update: {
              name: pi.name,
              amount: pi.amount,
              unit: pi.unit,
              category: pi.category,
              expiryDate: pi.expiryDate,
              notes: pi.notes,
            },
            create: {
              id: pi.id,
              name: pi.name,
              amount: pi.amount,
              unit: pi.unit,
              category: pi.category,
              expiryDate: pi.expiryDate,
              notes: pi.notes,
            },
          });
        }
        counts.pantryItems = data.pantryItems.length;
      }

      // 14. AI Ayarları
      if (data.aiSettings) {
        await tx.aISettings.upsert({
          where: { id: data.aiSettings.id || "default-ai" },
          update: {
            providerType: data.aiSettings.providerType || "ollama",
            baseUrl: data.aiSettings.baseUrl || "http://127.0.0.1:11434/v1",
            modelName: data.aiSettings.modelName || "llama3.2",
            connectionStatus: data.aiSettings.connectionStatus || "untested",
          },
          create: {
            id: data.aiSettings.id || "default-ai",
            providerType: data.aiSettings.providerType || "ollama",
            baseUrl: data.aiSettings.baseUrl || "http://127.0.0.1:11434/v1",
            modelName: data.aiSettings.modelName || "llama3.2",
            connectionStatus: data.aiSettings.connectionStatus || "untested",
          },
        });
        counts.aiSettings = 1;
      }
    });

    return NextResponse.json({
      success: true,
      message: "Tüm veriler başarıyla geri yüklendi.",
      counts,
    });
  } catch (error: any) {
    console.error("Backup import error:", error);
    return NextResponse.json(
      { error: error.message || "Yedek geri yüklenemedi" },
      { status: 400 }
    );
  }
}
