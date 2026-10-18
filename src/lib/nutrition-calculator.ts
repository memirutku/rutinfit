export interface NutritionalValues {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface FoodItemBasis extends NutritionalValues {
  basisGrams: number;
}

export interface IngredientWithFood {
  grams: number;
  foodItem: FoodItemBasis;
}

/**
 * Deterministik olarak makrolardan toplam kalori hesaplar:
 * Protein: 4 kcal/g
 * Karbonhidrat: 4 kcal/g
 * Yağ: 9 kcal/g
 */
export function calculateEnergyFromMacros(
  proteinG: number,
  carbsG: number,
  fatG: number
): number {
  return Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);
}

/**
 * Belirli gramajdaki bir besin için besin değerlerini hesaplar.
 */
export function calculatePortionMacros(
  foodItem: FoodItemBasis,
  grams: number
): NutritionalValues {
  if (foodItem.basisGrams <= 0 || grams <= 0) {
    return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  }
  const ratio = grams / foodItem.basisGrams;
  return {
    calories: Math.round(foodItem.calories * ratio * 10) / 10,
    proteinG: Math.round(foodItem.proteinG * ratio * 10) / 10,
    carbsG: Math.round(foodItem.carbsG * ratio * 10) / 10,
    fatG: Math.round(foodItem.fatG * ratio * 10) / 10,
  };
}

/**
 * Malzemeler listesinden bir tarifin toplam besin değerlerini hesaplar.
 */
export function calculateRecipeMacros(
  ingredients: IngredientWithFood[]
): NutritionalValues {
  return ingredients.reduce(
    (acc, curr) => {
      const portion = calculatePortionMacros(curr.foodItem, curr.grams);
      return {
        calories: Math.round((acc.calories + portion.calories) * 10) / 10,
        proteinG: Math.round((acc.proteinG + portion.proteinG) * 10) / 10,
        carbsG: Math.round((acc.carbsG + portion.carbsG) * 10) / 10,
        fatG: Math.round((acc.fatG + portion.fatG) * 10) / 10,
      };
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );
}

export interface DailyTargets {
  calorieTarget: number;
  calorieCeiling: number;
  proteinTargetG: number;
  fatTargetG: number;
  carbTargetG: number;
}

export interface DailyNutritionSummary {
  consumedCalories: number;
  consumedProtein: number;
  consumedCarbs: number;
  consumedFat: number;
  remainingCalories: number;
  remainingProtein: number;
  remainingCarbs: number;
  remainingFat: number;
  progressPercent: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  ceilingAlert: {
    isApproaching: boolean;
    isExceeded: boolean;
    diffFromCeiling: number;
    message: string | null;
  };
}

/**
 * Günlük kaydedilen besinlerden toplam ve kalan durumunu hesaplar.
 */
export function calculateDailySummary(
  loggedItems: NutritionalValues[],
  targets: DailyTargets
): DailyNutritionSummary {
  const totals = loggedItems.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.proteinG,
      carbs: acc.carbs + item.carbsG,
      fat: acc.fat + item.fatG,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const consumedCalories = Math.round(totals.calories);
  const consumedProtein = Math.round(totals.protein * 10) / 10;
  const consumedCarbs = Math.round(totals.carbs * 10) / 10;
  const consumedFat = Math.round(totals.fat * 10) / 10;

  const remainingCalories = targets.calorieTarget - consumedCalories;
  const remainingProtein = Math.max(
    0,
    Math.round((targets.proteinTargetG - consumedProtein) * 10) / 10
  );
  const remainingCarbs = Math.max(
    0,
    Math.round((targets.carbTargetG - consumedCarbs) * 10) / 10
  );
  const remainingFat = Math.max(
    0,
    Math.round((targets.fatTargetG - consumedFat) * 10) / 10
  );

  // 2100 kcal üst tavan kontrolü
  const diffFromCeiling = targets.calorieCeiling - consumedCalories;
  const isApproaching = diffFromCeiling <= 100 && diffFromCeiling > 0;
  const isExceeded = diffFromCeiling <= 0;

  let message: string | null = null;
  if (isExceeded) {
    message = `Bugün üst sınır (${targets.calorieCeiling} kcal) hafifçe aşıldı (+${Math.abs(
      diffFromCeiling
    )} kcal). Bu tamamen doğaldır; sonraki günlerde dengeyi sakin bir tempoyla koruyabilirsiniz.`;
  } else if (isApproaching) {
    message = `Günlük üst sınıra (${targets.calorieCeiling} kcal) yaklaşıyorsunuz (kalan: ${diffFromCeiling} kcal). Akşam öğününde sebze ve hafif protein tercih edebilirsiniz.`;
  }

  return {
    consumedCalories,
    consumedProtein,
    consumedCarbs,
    consumedFat,
    remainingCalories,
    remainingProtein,
    remainingCarbs,
    remainingFat,
    progressPercent: {
      calories: Math.min(
        150,
        Math.round((consumedCalories / targets.calorieTarget) * 100)
      ),
      protein: Math.min(
        150,
        Math.round((consumedProtein / targets.proteinTargetG) * 100)
      ),
      carbs: Math.min(
        150,
        Math.round((consumedCarbs / targets.carbTargetG) * 100)
      ),
      fat: Math.min(150, Math.round((consumedFat / targets.fatTargetG) * 100)),
    },
    ceilingAlert: {
      isApproaching,
      isExceeded,
      diffFromCeiling,
      message,
    },
  };
}
