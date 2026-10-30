/**
 * F73: Ev ölçüleri ve gram karşılıkları. Yerleşik değerler besin adına göre kurallarla gelir
 * (yaklaşık, ölçülü mutfak tartımlarına dayanır); kullanıcı kendi tartımını ekleyebilir
 * (FoodMeasure) ve aynı adlı yerleşik ölçünün yerine geçer.
 */
import { foldTr } from "./food-search";

export const MEASURE_NAMES = [
  "çay kaşığı",
  "tatlı kaşığı",
  "yemek kaşığı",
  "çay bardağı",
  "su bardağı",
  "kepçe",
  "kase",
  "dilim",
  "adet",
  "avuç",
  "küp",
  "kutu",
  "porsiyon",
] as const;
export type MeasureName = (typeof MEASURE_NAMES)[number];

export interface Measure {
  name: string;
  grams: number;
}

export interface MergedMeasure extends Measure {
  source: "builtin" | "custom";
  id?: string;
}

const m = (name: MeasureName, grams: number): Measure => ({ name, grams });

/** Sıra önemli: daha özel kural önce gelir (ilk eşleşen kullanılır). */
const RULES: Array<{ match: RegExp; measures: Measure[] }> = [
  { match: /corba/, measures: [m("kepçe", 120), m("kase", 250)] },
  { match: /yulaf/, measures: [m("yemek kaşığı", 8), m("su bardağı", 80), m("kase", 40)] },
  { match: /pirinc|baldo|basmati/, measures: [m("yemek kaşığı", 13), m("su bardağı", 180)] },
  { match: /bulgur/, measures: [m("yemek kaşığı", 13), m("su bardağı", 170)] },
  { match: /mercimek|nohut|kuru fasulye|barbunya/, measures: [m("yemek kaşığı", 12), m("su bardağı", 180)] },
  { match: /zeytinyag|aycicek yag|misir yag|sivi yag/, measures: [m("tatlı kaşığı", 5), m("yemek kaşığı", 13)] },
  { match: /tereyag/, measures: [m("tatlı kaşığı", 7), m("yemek kaşığı", 14)] },
  { match: /seker/, measures: [m("çay kaşığı", 4), m("tatlı kaşığı", 6), m("yemek kaşığı", 12), m("küp", 4)] },
  { match: /\bbal\b|recel|pekmez/, measures: [m("tatlı kaşığı", 10), m("yemek kaşığı", 20)] },
  { match: /salca/, measures: [m("tatlı kaşığı", 8), m("yemek kaşığı", 17)] },
  { match: /\bun\b|bugday unu/, measures: [m("yemek kaşığı", 9), m("su bardağı", 110)] },
  { match: /yogurt/, measures: [m("yemek kaşığı", 15), m("su bardağı", 210), m("kase", 200)] },
  { match: /\bsut\b|ayran|kefir/, measures: [m("çay bardağı", 100), m("su bardağı", 205)] },
  { match: /yumurta/, measures: [m("adet", 50)] },
  { match: /tam bugday ekmeg/, measures: [m("dilim", 30)] },
  { match: /ekmek|ekmeg/, measures: [m("dilim", 25)] },
  { match: /simit/, measures: [m("adet", 110)] },
  // B26: Ramazan pidesi ≈ 250 g (yaygın satış ağırlığı), dilimi ≈ 40 g; kuru hurma (Deglet Noor)
  // tanesi ≈ 8 g; zeytin tanesi ≈ 4 g ("zeytinyağı" yukarıdaki kuralla ayrılır).
  { match: /pide/, measures: [m("dilim", 40), m("adet", 250)] },
  { match: /hurma/, measures: [m("adet", 8)] },
  { match: /\bzeytin\b/, measures: [m("adet", 4)] },
  { match: /\blor\b/, measures: [m("yemek kaşığı", 20)] },
  { match: /peynir/, measures: [m("yemek kaşığı", 15), m("dilim", 30)] },
  { match: /ceviz/, measures: [m("avuç", 30)] },
  { match: /findik|badem|fistik/, measures: [m("avuç", 25)] },
  { match: /ton balig/, measures: [m("kutu", 120)] },
  { match: /tavuk gogs/, measures: [m("porsiyon", 150)] },
  { match: /\bmuz\b/, measures: [m("adet", 120)] },
  { match: /\belma\b/, measures: [m("adet", 180)] },
  { match: /portakal|mandalina/, measures: [m("adet", 150)] },
  { match: /domates/, measures: [m("adet", 120)] },
  { match: /salatalik/, measures: [m("adet", 150)] },
  { match: /patates/, measures: [m("adet", 170)] },
  { match: /sogan/, measures: [m("adet", 110)] },
  { match: /havuc/, measures: [m("adet", 70)] },
];

export function builtinMeasuresFor(foodName: string): Measure[] {
  const name = foldTr(foodName);
  return RULES.find((r) => r.match.test(name))?.measures.map((x) => ({ ...x })) ?? [];
}

/**
 * B11: Tarifte bu ölçüler tarifin bir porsiyonudur (toplam gram / porsiyon sayısı). "1 kase
 * mercimek çorbası" tarif kartındaki porsiyonla aynı kaloriyi verir; kepçe, su bardağı gibi
 * ölçüler yerleşik gramla kalır.
 */
export const RECIPE_SERVING_UNITS: ReadonlySet<string> = new Set(["porsiyon", "kase", "adet", "dilim"]);

/** Türk paketi tariflerinin talimatı "Porsiyon: 1 kase." ile başlar → "1 kase". */
export function recipePortionText(instructions: string | null | undefined): string | null {
  return /^Porsiyon: ([^.]+)\./.exec(instructions ?? "")?.[1]?.trim() || null;
}

/**
 * Tarifin ev ölçüleri: "porsiyon" (ve yerleşik kurallarda geçen kase/adet/dilim) bir porsiyondur.
 * Talimatta porsiyon ölçüsü yazıyorsa ("Porsiyon: 1 su bardağı") o ölçü de bir porsiyondur.
 */
export function recipeMeasuresFor(recipeName: string, portionGrams: number, instructions?: string | null): Measure[] {
  if (!(portionGrams > 0)) return [];
  const portion = Math.round(portionGrams * 10) / 10;
  const ownUnit = recipePortionText(instructions)?.replace(/^[\d.,]+\s*/, "");
  const isServing = (name: string) => RECIPE_SERVING_UNITS.has(name) || name === ownUnit;
  const builtin = builtinMeasuresFor(recipeName).map((x) => (isServing(x.name) ? { ...x, grams: portion } : x));
  const extra = ownUnit && ownUnit !== "porsiyon" && !builtin.some((x) => x.name === ownUnit) ? [{ name: ownUnit, grams: portion }] : [];
  return [...builtin.filter((x) => x.name !== "porsiyon"), ...extra, m("porsiyon", portion)].sort((a, b) => order(a.name) - order(b.name));
}

const order = (name: string) => {
  const i = MEASURE_NAMES.indexOf(name as MeasureName);
  return i === -1 ? MEASURE_NAMES.length : i;
};

export function mergeMeasures(builtin: Measure[], custom: Array<Measure & { id: string }>): MergedMeasure[] {
  const byName = new Map<string, MergedMeasure>();
  for (const b of builtin) byName.set(b.name, { ...b, source: "builtin" });
  for (const c of custom) byName.set(c.name, { id: c.id, name: c.name, grams: c.grams, source: "custom" });
  return [...byName.values()].sort((a, b) => order(a.name) - order(b.name));
}
