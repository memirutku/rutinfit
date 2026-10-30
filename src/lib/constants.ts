import type { DailyTargets } from "./nutrition-calculator";

/**
 * B02: Profil kurulmadan kullanılan nötr hedefler. Kimsenin kişisel değeri değildir; sihirbaz
 * tamamlanana kadar arayüz bunları "tahmini" diye gösterir. (Prisma şemasındaki sütun
 * varsayılanları eski kalabilir: yeni profil /api/profile'da bu değerlerle açıkça oluşturulur.)
 */
export const DEFAULT_TARGETS: Readonly<DailyTargets> = Object.freeze({
  calorieTarget: 2000,
  calorieCeiling: 2200,
  proteinTargetG: 100,
  fatTargetG: 65,
  carbTargetG: 250,
});

/** B02: Yeni kurulumda profilin başlangıç değerleri (sihirbaz alanları yine boş açılır). */
export const NEW_PROFILE_DEFAULTS = Object.freeze({
  heightCm: 170,
  age: 30,
  // Cinsiyet girilene kadar F56 kalori tabanının yüksek olanı (erkek: 1.500 kcal) uygulanır: daha güvenli.
  sex: "male" as "male" | "female",
  currentWeightKg: 70,
  wakeTime: "07:00",
  workdayHomeTime: "18:30",
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
