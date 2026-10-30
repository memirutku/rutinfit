import type { DailyTargets } from "./nutrition-calculator";

/** Profil yokken kullanılan varsayılan günlük hedefler (Prisma şemasındaki varsayılanlarla aynı). */
export const DEFAULT_TARGETS: Readonly<DailyTargets> = Object.freeze({
  calorieTarget: 2080,
  calorieCeiling: 2100,
  proteinTargetG: 165,
  fatTargetG: 60,
  carbTargetG: 220,
});

export function targetsFromProfile(profile: Partial<DailyTargets> | null | undefined): DailyTargets {
  if (!profile) return { ...DEFAULT_TARGETS };
  return {
    calorieTarget: profile.calorieTarget ?? DEFAULT_TARGETS.calorieTarget,
    calorieCeiling: profile.calorieCeiling ?? DEFAULT_TARGETS.calorieCeiling,
    proteinTargetG: profile.proteinTargetG ?? DEFAULT_TARGETS.proteinTargetG,
    fatTargetG: profile.fatTargetG ?? DEFAULT_TARGETS.fatTargetG,
    carbTargetG: profile.carbTargetG ?? DEFAULT_TARGETS.carbTargetG,
  };
}
