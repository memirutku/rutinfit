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
