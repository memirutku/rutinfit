/** Silinen bir öğün kaydını "Geri Al" ile aynen geri yüklemek için gereken POST gövdesi. */
export interface FoodLogLike {
  date: string;
  time: string;
  mealType: string;
  foodItemId?: string | null;
  recipeId?: string | null;
  name: string;
  grams: number;
  caloriesSnapshot: number;
  proteinSnapshot: number;
  carbsSnapshot: number;
  fatSnapshot: number;
}

export function buildRestorePayload(log: FoodLogLike) {
  return {
    date: log.date,
    time: log.time,
    mealType: log.mealType,
    foodItemId: log.foodItemId ?? null,
    recipeId: log.recipeId ?? null,
    name: log.name,
    grams: log.grams,
    caloriesSnapshot: log.caloriesSnapshot,
    proteinSnapshot: log.proteinSnapshot,
    carbsSnapshot: log.carbsSnapshot,
    fatSnapshot: log.fatSnapshot,
  };
}
