import { prisma } from '../prisma';
import { addDaysToDateString, startOfWeek } from '../date-utils';
import { aggregateShoppingList, resolveShoppingCategory, type PlannedRecipeItem } from '../shopping-aggregator';
import { HttpError } from '../api-error';
import { calculateNetShoppingList } from '../pantry-service';
import { normalizeName } from '../text';

export interface ShoppingNeed {
  name: string;
  amount: number;
  unit: string;
  category: string;
}

const weekPlans = (weekStart: string) =>
  prisma.mealPlan.findMany({
    where: { date: { gte: weekStart, lt: addDaysToDateString(weekStart, 7) } },
    orderBy: { date: 'asc' },
    include: {
      meals: {
        include: { recipe: { include: { ingredients: { include: { foodItem: true } } } } },
      },
    },
  });

export interface WeekPlanCoverage {
  /** Haftadaki planlı öğün sayısı. */
  plannedMeals: number;
  /** B09: tarife bağlı olmadığı için malzemesi bilinmeyen öğünlerin adları (tekrarsız, plan sırasıyla). */
  unlinkedMeals: string[];
}

/** B09: listenin neden boş ya da eksik olabileceğini açıklamak için haftanın plan kapsamı. */
export async function weekPlanCoverage(weekStart: string): Promise<WeekPlanCoverage> {
  const plans = await prisma.mealPlan.findMany({
    where: { date: { gte: weekStart, lt: addDaysToDateString(weekStart, 7) } },
    orderBy: { date: 'asc' },
    select: { meals: { select: { recipeId: true, customName: true, mealType: true } } },
  });
  const meals = plans.flatMap((p) => p.meals);
  const unlinked = meals.filter((m) => !m.recipeId).map((m) => m.customName?.trim() || 'Adsız öğün');
  return { plannedMeals: meals.length, unlinkedMeals: [...new Set(unlinked)] };
}

/** Haftanın (Pazartesi–Pazar) planlı tariflerinden porsiyona göre toplam ihtiyaç. */
export async function collectWeeklyNeeds(weekStart: string): Promise<ShoppingNeed[]> {
  const plans = await weekPlans(weekStart);

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

/**
 * Kaydedilmiş listeyi okur; hiçbir şey yazmaz. Yalnız elle eklenen kalemler varsa liste plandan
 * henüz kurulmamış sayılır (istemci bir kez kurar; elle kalemler korunur).
 */
export async function getShoppingList(dateInWeek: string) {
  const weekStart = startOfWeek(dateInWeek);
  const [items, coverage] = await Promise.all([
    prisma.shoppingListItem.findMany({
      where: { weekStart },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    weekPlanCoverage(weekStart),
  ]);
  return { weekStart, items, grouped: groupByCategory(items), generated: items.some((i) => !i.manual), ...coverage };
}

/** B09: kullanıcının elle eklediği kalem. Aynı hafta aynı ad (büyük/küçük harf farkı dahil) ikinci kez eklenmez. */
export async function addManualShoppingItem(input: { weekStart: string; name: string; amount: number; unit: string; category?: string }) {
  const weekStart = startOfWeek(input.weekStart);
  const existing = await prisma.shoppingListItem.findMany({ where: { weekStart }, select: { name: true } });
  if (existing.some((e) => normalizeName(e.name) === normalizeName(input.name))) {
    throw new HttpError(`"${input.name}" bu haftanın listesinde zaten var.`, 409);
  }
  return prisma.shoppingListItem.create({
    data: {
      weekStart,
      name: input.name,
      amount: input.amount,
      unit: input.unit,
      category: input.category ? resolveShoppingCategory(input.category, input.name) : resolveShoppingCategory(input.name),
      manual: true,
    },
  });
}

/** B09: elle eklenen kalemi siler. Plandan gelen kalem silinmez (yenilemede geri gelirdi); işaretlenir. */
export async function deleteManualShoppingItem(id: string) {
  const item = await prisma.shoppingListItem.findUnique({ where: { id } });
  if (!item) throw new HttpError('Alışveriş kalemi bulunamadı.', 404);
  if (!item.manual) throw new HttpError('Plandan gelen kalem silinemez; aldıysan işaretleyebilirsin.', 400);
  await prisma.shoppingListItem.delete({ where: { id } });
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
    // B09: elle eklenen kalemler kalır; aynı adlı plan kalemi onların yerine geçmez.
    const manualNames = new Set(previous.filter((p) => p.manual).map((p) => normalizeName(p.name)));
    const planned = toSave.filter((item) => !manualNames.has(normalizeName(item.name)));

    await tx.shoppingListItem.deleteMany({ where: { weekStart, manual: false } });
    if (planned.length > 0) {
      await tx.shoppingListItem.createMany({
        data: planned.map((item) => ({
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

  return { weekStart, items, grouped: groupByCategory(items), pantrySummary, ...(await weekPlanCoverage(weekStart)) };
}
