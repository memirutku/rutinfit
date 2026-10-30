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

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Makroları bir katsayıyla ölçekler (0,1 hassasiyet). */
export function scaleMacros(values: NutritionalValues, factor: number): NutritionalValues {
  return {
    calories: round1(values.calories * factor),
    proteinG: round1(values.proteinG * factor),
    carbsG: round1(values.carbsG * factor),
    fatG: round1(values.fatG * factor),
  };
}

/**
 * Tarifin malzeme listesi `recipeServings` porsiyon verir; `servings` porsiyonluk payın
 * gramajı ve makroları. Plan ekranı, "Yedim" ve öğün kaydı aynı formülü kullanır.
 */
export function calculateRecipePortion(
  ingredients: IngredientWithFood[],
  recipeServings: number,
  servings: number
): { grams: number; macros: NutritionalValues } {
  const total = calculateRecipeMacros(ingredients);
  const totalGrams = ingredients.reduce((acc, i) => acc + i.grams, 0);
  const factor = servings / (recipeServings > 0 ? recipeServings : 1);
  return { grams: round1(totalGrams * factor), macros: scaleMacros(total, factor) };
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
  // Tavana tam eşitlik aşım değildir.
  const isExceeded = diffFromCeiling < 0;
  const isApproaching = !isExceeded && diffFromCeiling <= 100;

  let message: string | null = null;
  if (isExceeded) {
    message = `Bugün üst sınır (${targets.calorieCeiling} kcal) hafifçe aşıldı (+${Math.abs(
      diffFromCeiling
    )} kcal). Bu tamamen doğaldır; sonraki günlerde dengeyi sakin bir tempoyla koruyabilirsiniz.`;
  } else if (diffFromCeiling === 0) {
    message = `Günlük üst sınıra (${targets.calorieCeiling} kcal) tam olarak ulaştınız. Bugün için ek öğüne gerek yok.`;
  } else if (isApproaching) {
    message = `Günlük üst sınıra (${targets.calorieCeiling} kcal) yaklaşıyorsunuz (kalan: ${diffFromCeiling} kcal). Akşam öğününde sebze ve hafif protein tercih edebilirsiniz.`;
  }

  const pct = (consumed: number, target: number) =>
    target > 0 ? Math.min(150, Math.round((consumed / target) * 100)) : 0;

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
      calories: pct(consumedCalories, targets.calorieTarget),
      protein: pct(consumedProtein, targets.proteinTargetG),
      carbs: pct(consumedCarbs, targets.carbTargetG),
      fat: pct(consumedFat, targets.fatTargetG),
    },
    ceilingAlert: {
      isApproaching,
      isExceeded,
      diffFromCeiling,
      message,
    },
  };
}
