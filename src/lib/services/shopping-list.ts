import { prisma } from '../prisma';
import { addDaysToDateString, startOfWeek } from '../date-utils';
import { aggregateShoppingList, type PlannedRecipeItem } from '../shopping-aggregator';
import { calculateNetShoppingList } from '../pantry-service';
import { normalizeName } from '../text';

export interface ShoppingNeed {
  name: string;
  amount: number;
  unit: string;
  category: string;
}

/** Haftanın (Pazartesi–Pazar) planlı tariflerinden porsiyona göre toplam ihtiyaç. */
export async function collectWeeklyNeeds(weekStart: string): Promise<ShoppingNeed[]> {
  const plans = await prisma.mealPlan.findMany({
    where: { date: { gte: weekStart, lt: addDaysToDateString(weekStart, 7) } },
    include: {
      meals: {
        include: { recipe: { include: { ingredients: { include: { foodItem: true } } } } },
      },
    },
  });

  const planned: PlannedRecipeItem[] = [];
  for (const plan of plans) {
    for (const meal of plan.meals) {
      if (!meal.recipe) continue;
      planned.push({
        recipeName: meal.recipe.name,
        servings: meal.servings,
        recipeServings: meal.recipe.servings,
        ingredients: meal.recipe.ingredients.map((ing) => ({
          name: ing.foodItem.name,
          category: ing.foodItem.category,
          grams: ing.grams,
        })),
      });
    }
  }

  // F31: plan bir kişilik porsiyon; alışveriş hane büyüklüğü kadar.
  const profile = await prisma.userProfile.findFirst({ select: { householdSize: true } });
  const household = Math.max(1, profile?.householdSize ?? 1);
  const aggregated = aggregateShoppingList(planned);
  return Object.values(aggregated)
    .flat()
    .map((item) => ({ name: item.name, amount: Math.round(item.totalGrams * household * 10) / 10, unit: 'g', category: item.category }));
}

function groupByCategory<T extends { category: string }>(items: T[]): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  for (const item of items) (grouped[item.category] ??= []).push(item);
  return grouped;
}

/** Kaydedilmiş listeyi okur; hiçbir şey yazmaz. */
export async function getShoppingList(dateInWeek: string) {
  const weekStart = startOfWeek(dateInWeek);
  const items = await prisma.shoppingListItem.findMany({
    where: { weekStart },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  return { weekStart, items, grouped: groupByCategory(items), generated: items.length > 0 };
}

/**
 * Haftalık listeyi plandan (isteğe bağlı kiler düşülerek) yeniden kurar.
 * Silme + oluşturma tek transaction'dadır; yarıda kalırsa eski liste korunur.
 * Önceden işaretlenmiş kalemler işaretli kalır.
 */
export async function generateShoppingList(dateInWeek: string, opts: { deductPantry: boolean }) {
  const weekStart = startOfWeek(dateInWeek);
  const needs = await collectWeeklyNeeds(weekStart);

  let toSave = needs;
  let pantrySummary = 'Kiler kontrolü yapılmadı.';
  if (opts.deductPantry && needs.length > 0) {
    const net = await calculateNetShoppingList(needs);
    pantrySummary = net.summary;
    toSave = net.itemsToBuy.map((b) => ({ name: b.name, amount: b.amount, unit: b.unit, category: b.category }));
  }

  const items = await prisma.$transaction(async (tx) => {
    const previous = await tx.shoppingListItem.findMany({ where: { weekStart } });
    const checkedNames = new Set(previous.filter((p) => p.checked).map((p) => normalizeName(p.name)));

    await tx.shoppingListItem.deleteMany({ where: { weekStart } });
    if (toSave.length > 0) {
      await tx.shoppingListItem.createMany({
        data: toSave.map((item) => ({
          weekStart,
          category: item.category,
          name: item.name,
          amount: item.amount,
          unit: item.unit,
          checked: checkedNames.has(normalizeName(item.name)),
        })),
      });
    }
    return tx.shoppingListItem.findMany({
      where: { weekStart },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  });

  return { weekStart, items, grouped: groupByCategory(items), pantrySummary };
}
