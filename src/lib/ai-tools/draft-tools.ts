import { prisma } from '../prisma';
import { calculateDailySummary } from '../nutrition-calculator';
import { calculateNetShoppingList } from '../pantry-service';
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

export async function draftMealPlanSwap(
  currentMealId: string,
  suggestedFood: { name: string; grams: number }
) {
  const currentMeal = await prisma.plannedMeal.findUnique({
    where: { id: currentMealId },
    include: {
      recipe: {
        include: {
          ingredients: { include: { foodItem: true } },
        },
      },
      mealPlan: true,
    },
  });

  if (!currentMeal) {
    throw new Error(`Öğün ID (${currentMealId}) bulunamadı.`);
  }

  // Calculate current meal macros
  let currentCalories = 0;
  let currentProtein = 0;
  if (currentMeal.recipe) {
    for (const ing of currentMeal.recipe.ingredients) {
      const factor = ing.grams / (ing.foodItem.basisGrams || 100);
      currentCalories += ing.foodItem.calories * factor;
      currentProtein += ing.foodItem.proteinG * factor;
    }
  }

  // Calculate replacement food
  const calc = await calculateRecipeNutrition([suggestedFood]);

  const deltaCalories = calc.totalCalories - Math.round(currentCalories);
  const deltaProtein = calc.totalProteinG - Math.round(currentProtein * 10) / 10;

  // Check user target
  const profile = await prisma.userProfile.findFirst();
  const calorieTarget = profile?.calorieTarget ?? 2080;
  const calorieCeiling = profile?.calorieCeiling ?? 2100;

  const date = currentMeal.mealPlan.date;
  const allLogsToday = await prisma.foodLog.findMany({ where: { date } });
  const currentTotalToday = allLogsToday.reduce((acc, l) => acc + l.caloriesSnapshot, 0);
  const projectedCalories = currentTotalToday + deltaCalories;

  const exceedsCeiling = projectedCalories > calorieCeiling;

  const impactSummary = [
    `Değişiklik: ${currentMeal.recipe?.name || currentMeal.customName} yerine ${suggestedFood.name} (${suggestedFood.grams}g).`,
    `Kalori Etkisi: ${deltaCalories >= 0 ? `+${deltaCalories}` : deltaCalories} kcal (Tahmini Günlük: ${projectedCalories} kcal).`,
    `Protein Etkisi: ${deltaProtein >= 0 ? `+${deltaProtein}` : deltaProtein}g protein.`,
    exceedsCeiling
      ? `UYARI: Bu değişim 2.100 kcal tavanını ${projectedCalories - calorieCeiling} kcal aşıyor!`
      : `Hedefe Uygun: 2.080 kcal hedefine ve 2.100 kcal tavanına uygundur.`,
  ].join('\n');

  return {
    mealPlanDate: date,
    currentMealId,
    previousName: currentMeal.recipe?.name || currentMeal.customName,
    suggestedFood: {
      name: suggestedFood.name,
      grams: suggestedFood.grams,
      calories: calc.totalCalories,
      proteinG: calc.totalProteinG,
      carbsG: calc.totalCarbsG,
      fatG: calc.totalFatG,
    },
    deltaCalories,
    deltaProtein,
    projectedCalories,
    exceedsCeiling,
    impactSummary,
  };
}

export async function draftShoppingListDelta(
  plannedIngredients: Array<{ name: string; amount: number; unit: string; category?: string }>
) {
  // First calculate net requirements considering pantry inventory
  const netResult = await calculateNetShoppingList(
    plannedIngredients.map((p) => ({
      name: p.name,
      amount: p.amount,
      unit: p.unit || 'g',
      category: p.category || 'Diğer',
    }))
  );

  const existingItems = await prisma.shoppingListItem.findMany();
  const existingMap = new Map<string, number>();

  for (const item of existingItems) {
    existingMap.set(item.name.toLowerCase().trim(), item.amount);
  }

  const additions: Array<{ name: string; amount: number; unit: string; category: string }> = [];

  for (const ing of netResult.itemsToBuy) {
    const key = ing.name.toLowerCase().trim();
    if (!existingMap.has(key)) {
      additions.push({
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit || 'g',
        category: ing.category || 'Diğer',
      });
    }
  }

  const impactSummary = [
    netResult.totalCovered > 0
      ? `Kiler Kontrolü: ${netResult.totalCovered} malzeme kilerinizden karşılandı.`
      : '',
    additions.length > 0
      ? `Alışveriş listesine ${additions.length} yeni malzeme eklenecek: ${additions.map((a) => a.name).join(', ')}.`
      : 'Gerekli tüm malzemeler zaten kilerde veya alışveriş listenizde mevcut.',
  ].filter(Boolean).join(' ');

  return {
    totalPlanned: plannedIngredients.length,
    coveredByPantry: netResult.totalCovered,
    alreadyInList: plannedIngredients.length - netResult.totalCovered - additions.length,
    newItemsToAdd: additions,
    impactSummary,
  };
}

export async function parseAndPreviewFileImport(fileId: string) {
  const file = await prisma.uploadedFile.findUnique({
    where: { id: fileId },
    include: { artifacts: true },
  });

  if (!file) {
    throw new Error(`Dosya ID (${fileId}) veritabanında bulunamadı.`);
  }

  const artifact = file.artifacts[0];
  if (!artifact) {
    throw new Error(`Dosyaya (${file.originalName}) ait çıkarılmış yapısal veri bulunamadı.`);
  }

  const structuredData = JSON.parse(artifact.structuredData || '{}');
  const uncertainties = JSON.parse(artifact.uncertainties || '[]');

  let draftType = 'bulk_import';
  let impactSummary = `Dosya İçe Aktarımı: ${file.originalName} (${artifact.sourceSummary || artifact.normalizedType})`;

  if (artifact.normalizedType === 'meal_plan') {
    draftType = 'meal_plan';
    impactSummary = `Yeni Beslenme Planı İçe Aktarımı: ${file.originalName} içeriği mevcut plana dönüştürülecek.`;
  } else if (artifact.normalizedType === 'workout_plan') {
    draftType = 'workout_session';
    impactSummary = `Antrenman Programı İçe Aktarımı: ${file.originalName} antrenman kayıtlarına eklenecek.`;
  }

  return {
    fileId: file.id,
    fileName: file.originalName,
    draftType,
    normalizedType: artifact.normalizedType,
    confidence: artifact.confidence,
    uncertainties,
    structuredData,
    impactSummary,
  };
}
