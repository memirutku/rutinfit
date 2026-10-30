/**
 * F06: Doğal dille yazılan öğünü katalogla eşler. Sayılar her zaman katalogdan gelir:
 * besinde 100 g değerleri, tarifte malzemeleri. Model kullanılmaz; kullanıcı önizlemede onaylar.
 */
import { prisma } from "../prisma";
import { rankFoods } from "../food-search";
import { builtinMeasuresFor, mergeMeasures } from "../measures";
import { parseFoodText, splitFoodText } from "../natural-log";
import { calculatePortionMacros, calculateRecipeMacros, scaleMacros, type NutritionalValues } from "../nutrition-calculator";
import { QUICK_FOODS, type QuickFood } from "../quick-foods";

export interface MatchRef {
  type: "food" | "recipe";
  id: string;
  name: string;
}

export interface ParsedMealItem {
  raw: string;
  /** Ayrıştırılan besin metni ("1 kase mercimek çorbası" → "mercimek çorbası"). */
  food: string;
  quantity: number;
  unit: string | null;
  match: MatchRef | null;
  alternatives: MatchRef[];
  grams: number | null;
  macros: NutritionalValues | null;
  note?: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** B10: hızlı kalem (simit, ekmek) katalogda yoksa hızlı ekleme çipinin kullandığı kayıt oluşturulur. */
async function ensureQuickFood(def: QuickFood) {
  return (
    (await prisma.foodItem.findFirst({ where: { name: def.name, source: "RutinFit" }, include: { measures: true } })) ??
    (await prisma.foodItem.create({
      data: {
        name: def.name,
        category: def.category,
        basisGrams: def.basisGrams,
        calories: def.calories,
        proteinG: def.proteinG,
        carbsG: def.carbsG,
        fatG: def.fatG,
        source: "RutinFit",
        confidence: "Tahmini",
      },
      include: { measures: true },
    }))
  );
}

export async function parseMealText(text: string): Promise<ParsedMealItem[]> {
  const [foods, recipes] = await Promise.all([
    prisma.foodItem.findMany({ include: { measures: true } }),
    prisma.recipe.findMany({ include: { ingredients: { include: { foodItem: true } } } }),
  ]);
  const candidates = [
    ...foods.map((f) => ({ id: `food:${f.id}`, name: f.name, brand: f.brand, confidence: f.confidence })),
    ...recipes.map((r) => ({ id: `recipe:${r.id}`, name: r.name, brand: null, confidence: "Yüksek" })),
  ];
  const ref = (c: { id: string; name: string }): MatchRef => {
    const [type, id] = c.id.split(":") as ["food" | "recipe", string];
    return { type, id, name: c.name };
  };

  // B10: katalogda karşılığı olmayan hızlı kalemler yalnız hiçbir katalog eşleşmesi yoksa denenir.
  const quickCandidates = Object.values(QUICK_FOODS)
    .filter((q) => !foods.some((f) => f.name === q.name))
    .map((q) => ({ id: `quick:${q.name}`, name: q.name, brand: null, confidence: null, def: q as QuickFood }));

  const items: ParsedMealItem[] = [];
  for (const raw of splitFoodText(text)) {
    const parsed = parseFoodText(raw);
    if (!rankFoods(candidates, parsed.food).length) {
      const quick = rankFoods(quickCandidates, parsed.food)[0];
      if (quick) {
        const created = await ensureQuickFood(quick.def);
        if (!foods.some((f) => f.id === created.id)) foods.push(created);
        candidates.push({ id: `food:${created.id}`, name: created.name, brand: created.brand, confidence: created.confidence });
      }
    }
    items.push(matchItem(raw, parsed));
  }
  return items;

  function matchItem(raw: string, parsed: ReturnType<typeof parseFoodText>): ParsedMealItem {
    const ranked = rankFoods(candidates, parsed.food);
    const base = { raw, food: parsed.food, quantity: parsed.quantity, unit: parsed.unit, alternatives: ranked.slice(1, 4).map(ref) };
    if (!ranked.length) return { ...base, match: null, grams: null, macros: null, note: `"${parsed.food}" katalogda bulunamadı.` };
    const match = ref(ranked[0]);
    let grams: number;
    let note: string | undefined;

    if (match.type === "recipe") {
      const recipe = recipes.find((r) => r.id === match.id)!;
      const ingredients = recipe.ingredients.map((i) => ({ grams: i.grams, foodItem: i.foodItem }));
      const total = ingredients.reduce((a, i) => a + i.grams, 0);
      const portion = recipe.servings > 0 ? total / recipe.servings : total;
      const measure = parsed.unit ? builtinMeasuresFor(recipe.name).find((m) => m.name === parsed.unit) : undefined;
      if (parsed.unit === "gram") grams = parsed.quantity;
      else if (measure) grams = parsed.quantity * measure.grams;
      else {
        grams = parsed.quantity * portion;
        if (parsed.unit && !["porsiyon", "adet"].includes(parsed.unit)) note = `"${parsed.unit}" bu tarif için bilinmiyor; ${parsed.quantity} porsiyon sayıldı.`;
      }
      grams = round1(grams);
      const macros = scaleMacros(calculateRecipeMacros(ingredients), total > 0 ? grams / total : 0);
      return { ...base, match, grams, macros, note };
    }

    const food = foods.find((f) => f.id === match.id)!;
    const measures = mergeMeasures(builtinMeasuresFor(food.name), food.measures);
    const unit = parsed.unit ?? (measures.some((m) => m.name === "adet") ? "adet" : null);
    const measure = unit && unit !== "gram" ? measures.find((m) => m.name === unit) : undefined;
    if (unit === "gram") grams = parsed.quantity;
    else if (measure) grams = parsed.quantity * measure.grams;
    else {
      grams = 100;
      note = parsed.unit
        ? `"${parsed.unit}" ölçüsü bu besin için tanımlı değil; 100 g sayıldı, düzeltebilirsin.`
        : "Miktar belirsiz; 100 g sayıldı, düzeltebilirsin.";
    }
    grams = round1(grams);
    return { ...base, match, grams, macros: calculatePortionMacros({ ...food, basisGrams: food.basisGrams > 0 ? food.basisGrams : 100 }, grams), note };
  }
}
