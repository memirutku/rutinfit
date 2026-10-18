import { prisma } from '../prisma';
import { calculateDailySummary } from '../nutrition-calculator';
import { getOpenGymLocalState, checkOpenGymHealth } from '../opengym-client';
import { getPantryInventory } from '../pantry-service';
import { getProductByBarcode, searchProductsByName } from '../openfoodfacts-client';
import { getLocalDateString } from '../date-utils';

export async function getUserProfile() {
  const profile = await prisma.userProfile.findFirst();
  if (!profile) {
    return {
      exists: false,
      message: 'Kullanıcı profili henüz oluşturulmamış.',
    };
  }
  return {
    exists: true,
    heightCm: profile.heightCm,
    currentWeightKg: profile.currentWeightKg,
    age: profile.age,
    sex: profile.sex,
    wakeTime: profile.wakeTime,
    workdayHomeTime: profile.workdayHomeTime,
    targets: {
      calorieTarget: profile.calorieTarget,
      calorieCeiling: profile.calorieCeiling,
      proteinTargetG: profile.proteinTargetG,
      fatTargetG: profile.fatTargetG,
      carbTargetG: profile.carbTargetG,
    },
  };
}

export async function getNutritionTargets() {
  const profile = await prisma.userProfile.findFirst();
  return {
    calorieTarget: profile?.calorieTarget ?? 2080,
    calorieCeiling: profile?.calorieCeiling ?? 2100,
    proteinTargetG: profile?.proteinTargetG ?? 165,
    fatTargetG: profile?.fatTargetG ?? 60,
    carbTargetG: profile?.carbTargetG ?? 220,
    creatineTargetG: 5.0,
    rule: '2.080 kcal temel hedef, 2.100 kcal mutlak tavan, 165g protein, 60g yağ, 220g karbonhidrat.',
  };
}

export async function getDashboardSummary(dateStr?: string) {
  const date = dateStr || getLocalDateString();
  const [profile, logs, workoutSessions] = await Promise.all([
    prisma.userProfile.findFirst(),
    prisma.foodLog.findMany({ where: { date } }),
    prisma.workoutSession.findMany({ where: { date }, include: { setLogs: true } }),
  ]);

  const targets = {
    calorieTarget: profile?.calorieTarget ?? 2080,
    calorieCeiling: profile?.calorieCeiling ?? 2100,
    proteinTargetG: profile?.proteinTargetG ?? 165,
    fatTargetG: profile?.fatTargetG ?? 60,
    carbTargetG: profile?.carbTargetG ?? 220,
  };

  const consumed = calculateDailySummary(
    logs.map((l) => ({
      calories: l.caloriesSnapshot,
      proteinG: l.proteinSnapshot,
      carbsG: l.carbsSnapshot,
      fatG: l.fatSnapshot,
    })),
    targets
  );

  return {
    date,
    targets,
    consumed: {
      calories: consumed.consumedCalories,
      proteinG: consumed.consumedProtein,
      carbsG: consumed.consumedCarbs,
      fatG: consumed.consumedFat,
    },
    remainingCalories: consumed.remainingCalories,
    ceilingAlert: consumed.ceilingAlert,
    loggedFoodCount: logs.length,
    workoutSessionsCompleted: workoutSessions.length,
    completedWorkouts: workoutSessions.map((w) => ({
      name: w.name,
      durationMinutes: w.durationMinutes,
      rpe: w.rpe,
      setCount: w.setLogs.length,
    })),
  };
}

export async function getFoodCatalog(query?: string) {
  const where = query
    ? {
        OR: [
          { name: { contains: query } },
          { category: { contains: query } },
        ],
      }
    : undefined;

  const foods = await prisma.foodItem.findMany({
    where,
    take: 50,
    orderBy: { name: 'asc' },
  });

  return foods.map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category,
    basisGrams: f.basisGrams,
    calories: f.calories,
    proteinG: f.proteinG,
    carbsG: f.carbsG,
    fatG: f.fatG,
    confidence: f.confidence,
    source: f.source,
  }));
}

export async function getSavedRecipes() {
  const recipes = await prisma.recipe.findMany({
    include: {
      ingredients: {
        include: { foodItem: true },
      },
    },
    take: 30,
    orderBy: { createdAt: 'desc' },
  });

  return recipes.map((r) => {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    const ingredients = r.ingredients.map((ing) => {
      const factor = ing.grams / (ing.foodItem.basisGrams || 100);
      const cal = ing.foodItem.calories * factor;
      const pro = ing.foodItem.proteinG * factor;
      const carb = ing.foodItem.carbsG * factor;
      const fat = ing.foodItem.fatG * factor;

      totalCalories += cal;
      totalProtein += pro;
      totalCarbs += carb;
      totalFat += fat;

      return {
        name: ing.foodItem.name,
        grams: ing.grams,
        calories: Math.round(cal),
        proteinG: Math.round(pro * 10) / 10,
      };
    });

    return {
      id: r.id,
      name: r.name,
      servings: r.servings,
      prepMinutes: r.prepMinutes,
      instructions: r.instructions,
      totalCalories: Math.round(totalCalories),
      totalProteinG: Math.round(totalProtein * 10) / 10,
      totalCarbsG: Math.round(totalCarbs * 10) / 10,
      totalFatG: Math.round(totalFat * 10) / 10,
      ingredients,
    };
  });
}

export async function getActiveMealPlan(dateStr?: string) {
  const date = dateStr || getLocalDateString();
  const plan = await prisma.mealPlan.findUnique({
    where: { date },
    include: {
      meals: {
        include: {
          recipe: {
            include: {
              ingredients: {
                include: { foodItem: true },
              },
            },
          },
        },
      },
    },
  });

  if (!plan) {
    return {
      date,
      hasPlan: false,
      message: `${date} tarihi için kayıtlı öğün planı bulunamadı.`,
    };
  }

  return {
    date,
    hasPlan: true,
    notes: plan.notes,
    meals: plan.meals.map((m) => ({
      id: m.id,
      mealType: m.mealType,
      plannedTime: m.plannedTime,
      isCompleted: m.isCompleted,
      recipeName: m.recipe?.name || m.customName || 'Belirtilmemiş',
      servings: m.servings,
    })),
  };
}

export async function getWorkoutRoutine() {
  const templates = await prisma.workoutTemplate.findMany({
    orderBy: { dayOfWeek: 'asc' },
    include: {
      exercises: {
        orderBy: { orderIndex: 'asc' },
      },
    },
  });

  return templates.map((t) => ({
    id: t.id,
    dayOfWeek: t.dayOfWeek,
    name: t.name,
    type: t.type,
    targetDurationMinutes: t.targetDurationMinutes,
    notes: t.notes,
    exercises: t.exercises.map((e) => ({
      name: e.exerciseName,
      targetSets: e.targetSets,
      reps: `${e.repMin}-${e.repMax}`,
      restSeconds: e.restSeconds,
    })),
  }));
}

export async function getOpenGymSummary() {
  const health = await checkOpenGymHealth();
  const state = await getOpenGymLocalState();

  const totalWorkouts = state?.workouts?.length ?? 0;
  const recentWorkouts = (state?.workouts ?? []).slice(-5).map((w) => ({
    id: w.id,
    date: w.date,
    name: w.name,
    exerciseCount: w.exercises.length,
    totalSets: w.exercises.reduce((acc, ex) => acc + ex.sets.length, 0),
  }));

  const recentWeights = (state?.bodyWeight ?? []).slice(-7).map((b) => ({
    date: b.date,
    weightKg: b.weight,
  }));

  return {
    isOnline: health.isOnline,
    serviceUrl: health.url,
    totalWorkouts,
    recentWorkouts,
    recentWeights,
    lastSyncTimestamp: new Date().toISOString(),
  };
}

export async function getWeightAndWellbeingHistory() {
  const [weights, wellbeing] = await Promise.all([
    prisma.weightLog.findMany({
      take: 14,
      orderBy: { date: 'desc' },
    }),
    prisma.dailyWellbeing.findMany({
      take: 14,
      orderBy: { date: 'desc' },
    }),
  ]);

  return {
    weights: weights.map((w) => ({
      date: w.date,
      weightKg: w.weightKg,
      conditionsNote: w.conditionsNote,
    })),
    wellbeing: wellbeing.map((b) => ({
      date: b.date,
      energy1to5: b.energy1to5,
      hunger1to5: b.hunger1to5,
      sleepMinutes: b.sleepMinutes,
      stress1to5: b.stress1to5,
      notes: b.notes,
    })),
  };
}

export async function getSupplementSchedule() {
  const today = getLocalDateString();
  const logs = await prisma.supplementLog.findMany({
    where: { date: today },
  });

  const creatineLog = logs.find((l) => l.name.toLowerCase().includes('kreatin'));

  return {
    today,
    dailyTarget: {
      name: 'Kreatin Monohidrat',
      doseGrams: 5.0,
      takenToday: !!creatineLog?.taken,
    },
    allLogsToday: logs,
  };
}

export async function getShoppingList() {
  const items = await prisma.shoppingListItem.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  return {
    totalItems: items.length,
    checkedCount: items.filter((i) => i.checked).length,
    pendingCount: items.filter((i) => !i.checked).length,
    items: items.map((i) => ({
      id: i.id,
      weekStart: i.weekStart,
      category: i.category,
      name: i.name,
      amount: i.amount,
      unit: i.unit,
      checked: i.checked,
    })),
  };
}

export async function getPantrySummary() {
  const items = await getPantryInventory();
  return {
    totalItems: items.length,
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      amount: i.amount,
      unit: i.unit,
      category: i.category,
      expiryDate: i.expiryDate,
    })),
  };
}

export async function searchPackagedFood(queryOrBarcode: string) {
  const isBarcode = /^[0-9]{8,14}$/.test(queryOrBarcode.trim());
  if (isBarcode) {
    return getProductByBarcode(queryOrBarcode.trim());
  }
  return searchProductsByName(queryOrBarcode.trim());
}

