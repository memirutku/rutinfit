/**
 * B15: Kalori hedefi ile makro hedeflerinin (protein, karbonhidrat, yağ) enerjisi uyuşuyor mu?
 * Kalori hedefi değişince makrolar eski değerde kalıyordu; burada fark ölçülür ve makrolar mevcut
 * oranları korunarak yeni hedefe dağıtılır. Kalori hedefine dokunulmaz: güvenlik tabanı
 * (src/lib/safety.ts) kontrolü kalori hedefi üzerinden aynen sürer.
 */
import { DEFAULT_TARGETS } from "./constants";
import { calculateEnergyFromMacros } from "./nutrition-calculator";

export interface MacroTargets {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MacroMismatch {
  /** Makroların enerjisi (4/4/9 kcal/g). */
  macroKcal: number;
  /** Makro enerjisi − kalori hedefi. */
  diff: number;
  mismatched: boolean;
}

const safe = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
const energyOf = (m: MacroTargets) => calculateEnergyFromMacros(safe(m.proteinG), safe(m.carbsG), safe(m.fatG));

/** Tam sayı makro yuvarlaması payı: hedefin %3'ü, en az 25 kcal. */
const tolerance = (calorieTarget: number) => Math.max(25, calorieTarget * 0.03);

export function macroMismatch(calorieTarget: number, macros: MacroTargets): MacroMismatch {
  const macroKcal = energyOf(macros);
  const diff = macroKcal - (Number.isFinite(calorieTarget) ? calorieTarget : 0);
  return { macroKcal, diff, mismatched: calorieTarget > 0 && Math.abs(diff) > tolerance(calorieTarget) };
}

/**
 * Makroları enerjideki paylarını koruyarak kalori hedefine ölçekler (her biri tam grama yuvarlanır).
 * Makrolar boşsa varsayılan dağılımın oranları kullanılır. Geçersiz hedefte null.
 */
export function redistributeMacros(calorieTarget: number, macros: MacroTargets): MacroTargets | null {
  if (!Number.isFinite(calorieTarget) || calorieTarget <= 0) return null;
  const base: MacroTargets =
    energyOf(macros) > 0
      ? { proteinG: safe(macros.proteinG), carbsG: safe(macros.carbsG), fatG: safe(macros.fatG) }
      : { proteinG: DEFAULT_TARGETS.proteinTargetG, carbsG: DEFAULT_TARGETS.carbTargetG, fatG: DEFAULT_TARGETS.fatTargetG };
  const factor = calorieTarget / energyOf(base);
  return {
    proteinG: Math.round(base.proteinG * factor),
    carbsG: Math.round(base.carbsG * factor),
    fatG: Math.round(base.fatG * factor),
  };
}
