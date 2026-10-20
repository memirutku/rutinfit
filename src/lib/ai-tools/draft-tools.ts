import { prisma } from '../prisma';
import { normalizeName, wordsTr } from '../text';

export interface IngredientCalculationInput {
  foodItemId?: string;
  name?: string;
  grams: number;
}

type CatalogFood = NonNullable<Awaited<ReturnType<typeof prisma.foodItem.findFirst>>>;

/**
 * Model çıktısındaki malzeme adını katalogla eşler.
 * Öncelik: tam ad → sorgunun tüm kelimelerini içeren en kısa ad. Alt dize eşleşmesi kullanılmaz
 * ("Yağ" → "Yağsız Yoğurt", "Yulaf" → "Yulaf Sütü" gibi yanlış eşleşmeleri önler).
 */
export function matchFoodByName<T extends { name: string }>(query: string, foods: T[]): T | null {
  const q = normalizeName(query);
  if (!q) return null;
  const exact = foods.find((f) => normalizeName(f.name) === q);
  if (exact) return exact;

  const queryWords = wordsTr(q);
  const candidates = foods
    .map((f) => ({ food: f, words: wordsTr(f.name) }))
    .filter(({ words }) => queryWords.every((w) => words.includes(w)))
    .sort((a, b) => a.words.length - b.words.length);
  return candidates[0]?.food ?? null;
}

export async function calculateRecipeNutrition(ingredients: IngredientCalculationInput[]) {
  let totalCalories = 0;
  let totalProteinG = 0;
  let totalCarbsG = 0;
  let totalFatG = 0;
  const itemized: any[] = [];
  const warnings: string[] = [];
  const missingIngredients: string[] = [];
  let catalog: CatalogFood[] | null = null;

  for (const item of ingredients) {
    let food: CatalogFood | null = null;
    if (item.foodItemId) {
      food = await prisma.foodItem.findUnique({ where: { id: item.foodItemId } });
    }
    if (!food && item.name) {
      catalog ??= await prisma.foodItem.findMany();
      food = matchFoodByName(item.name, catalog);
    }

    if (!food) {
      const label = item.name || item.foodItemId || 'Bilinmeyen Besin';
      missingIngredients.push(label);
      warnings.push(`"${label}" katalogda bulunamadı; makro toplamına dahil edilmedi.`);
      itemized.push({
        name: label,
        grams: item.grams,
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        foundInDb: false,
      });
      continue;
    }

    const factor = item.grams / (food.basisGrams || 100);
    const cal = food.calories * factor;
    const pro = food.proteinG * factor;
    const carb = food.carbsG * factor;
    const fat = food.fatG * factor;

    totalCalories += cal;
    totalProteinG += pro;
    totalCarbsG += carb;
    totalFatG += fat;

    itemized.push({
      foodItemId: food.id,
      name: food.name,
      grams: item.grams,
      calories: Math.round(cal),
      proteinG: Math.round(pro * 10) / 10,
      carbsG: Math.round(carb * 10) / 10,
      fatG: Math.round(fat * 10) / 10,
      foundInDb: true,
    });
  }

  return {
    totalCalories: Math.round(totalCalories),
    totalProteinG: Math.round(totalProteinG * 10) / 10,
    totalCarbsG: Math.round(totalCarbsG * 10) / 10,
    totalFatG: Math.round(totalFatG * 10) / 10,
    itemized,
    warnings,
    missingIngredients,
    isComplete: missingIngredients.length === 0,
  };
}
