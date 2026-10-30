/**
 * F13: Su, çay, kahve ve alkol takibi. Değerler yaklaşıktır; kafein ve alkol miktarı
 * demleme ve markaya göre değişir.
 */
export const DRINK_KINDS = ["water", "tea", "coffee", "alcohol", "other"] as const;
export type DrinkKind = (typeof DRINK_KINDS)[number];

export const DRINK_KIND_LABELS: Record<DrinkKind, string> = {
  water: "Su",
  tea: "Çay",
  coffee: "Kahve",
  alcohol: "Alkol",
  other: "Diğer",
};

/** EFSA: sağlıklı yetişkinler için günlük 400 mg kafein güvenli kabul edilir. */
export const CAFFEINE_DAILY_LIMIT_MG = 400;
/** Bir standart içki = 10 g saf alkol (DSÖ). */
export const STANDARD_DRINK_G = 10;

export interface DrinkPreset {
  id: string;
  kind: DrinkKind;
  /** Kayıttaki ad. */
  name: string;
  /** Düğme etiketi. */
  label: string;
  ml: number;
  caffeineMg: number;
  alcoholG: number;
  kcal: number;
  carbsG: number;
  proteinG: number;
}

const preset = (p: Partial<DrinkPreset> & Pick<DrinkPreset, "id" | "kind" | "name" | "label" | "ml">): DrinkPreset => ({
  caffeineMg: 0,
  alcoholG: 0,
  kcal: 0,
  carbsG: 0,
  proteinG: 0,
  ...p,
});

export const DRINK_PRESETS: DrinkPreset[] = [
  preset({ id: "su-bardagi", kind: "water", name: "Su", label: "Su bardağı · 200 ml", ml: 200 }),
  preset({ id: "su-sise", kind: "water", name: "Su", label: "Şişe su · 500 ml", ml: 500 }),
  preset({ id: "cay", kind: "tea", name: "Çay", label: "Çay · 1 bardak", ml: 100, caffeineMg: 30 }),
  preset({ id: "turk-kahvesi", kind: "coffee", name: "Türk kahvesi", label: "Türk kahvesi", ml: 65, caffeineMg: 60 }),
  preset({ id: "filtre-kahve", kind: "coffee", name: "Filtre kahve", label: "Filtre kahve · 240 ml", ml: 240, caffeineMg: 95 }),
  preset({ id: "espresso", kind: "coffee", name: "Espresso", label: "Espresso", ml: 30, caffeineMg: 63 }),
  preset({ id: "bira", kind: "alcohol", name: "Bira", label: "Bira · 33 cl", ml: 330, alcoholG: 13, kcal: 143, carbsG: 13, proteinG: 1 }),
  preset({ id: "sarap", kind: "alcohol", name: "Şarap", label: "Şarap · kadeh", ml: 150, alcoholG: 14, kcal: 125, carbsG: 4 }),
  preset({ id: "raki", kind: "alcohol", name: "Rakı", label: "Rakı · tek", ml: 50, alcoholG: 18, kcal: 125 }),
];

export function findDrinkPreset(id: string): DrinkPreset | undefined {
  return DRINK_PRESETS.find((p) => p.id === id);
}

export interface DrinkAmounts {
  kind: string;
  ml: number;
  caffeineMg: number;
  alcoholG: number;
}

export interface DrinkSummary {
  /** Alkol dışındaki tüm içecekler (çay ve kahve de sıvı ihtiyacına sayılır). */
  hydrationMl: number;
  waterTargetMl: number;
  progressPercent: number;
  caffeineMg: number;
  caffeineHigh: boolean;
  alcoholG: number;
  standardDrinks: number;
}

export function summarizeDrinks(logs: DrinkAmounts[], waterTargetMl: number): DrinkSummary {
  const hydrationMl = logs.filter((l) => l.kind !== "alcohol").reduce((a, l) => a + l.ml, 0);
  const caffeineMg = logs.reduce((a, l) => a + l.caffeineMg, 0);
  const alcoholG = logs.reduce((a, l) => a + l.alcoholG, 0);
  return {
    hydrationMl,
    waterTargetMl,
    progressPercent: waterTargetMl > 0 ? Math.round((hydrationMl / waterTargetMl) * 100) : 0,
    caffeineMg,
    caffeineHigh: caffeineMg > CAFFEINE_DAILY_LIMIT_MG,
    alcoholG,
    standardDrinks: Math.round((alcoholG / STANDARD_DRINK_G) * 10) / 10,
  };
}
