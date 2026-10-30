/**
 * F06: Doğal dille yazılan öğünü katalogla eşler. Sayılar her zaman katalogdan gelir:
 * besinde 100 g değerleri, tarifte malzemeleri. Model kullanılmaz; kullanıcı önizlemede onaylar.
 */
import { prisma } from "../prisma";
import { rankFoods } from "../food-search";
import { builtinMeasuresFor, mergeMeasures } from "../measures";
import { parseFoodText, splitFoodText } from "../natural-log";
import { calculatePortionMacros, calculateRecipeMacros, scaleMacros, type NutritionalValues } from "../nutrition-calculator";

export interface MatchRef {
  type: "food" | "recipe";
  id: string;
  name: string;
}

export interface ParsedMealItem {
  raw: string;
  quantity: number;
  unit: string | null;
  match: MatchRef | null;
  alternatives: MatchRef[];
  grams: number | null;
  macros: NutritionalValues | null;
  note?: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

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

  return splitFoodText(text).map((raw) => {
    const parsed = parseFoodText(raw);
    const ranked = rankFoods(candidates, parsed.food);
    const base = { raw, quantity: parsed.quantity, unit: parsed.unit, alternatives: ranked.slice(1, 4).map(ref) };
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
  });
}
