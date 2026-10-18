export interface SetPerformance {
  setNumber: number;
  weightKg: number;
  reps: number;
  targetRepMin: number;
  targetRepMax: number;
}

export interface ProgressionResult {
  isTargetMetAllSets: boolean;
  currentMaxWeight: number;
  recommendedNextWeightKg: number;
  message: string;
  badge: "progression" | "maintain" | "info";
}

/**
 * Kullanıcının set performansına göre sonraki seans için ağırlık önerisi üretir.
 * - Tüm setlerde hedef tekrarın üst sınırına ulaşıldıysa: +2.5 kg artış önerisi.
 * - Ulaşılamadıysa: Ağırlığı düşürmeden, aynı ağırlıkta kalarak formu koruma tavsiyesi.
 * - Suçlayıcı veya yargılayıcı bir dil asla kullanılmaz.
 */
export function evaluateExerciseProgression(
  sets: SetPerformance[],
  incrementKg: number = 2.5
): ProgressionResult {
  if (!sets || sets.length === 0) {
    return {
      isTargetMetAllSets: false,
      currentMaxWeight: 0,
      recommendedNextWeightKg: 0,
      message: "Henüz set kaydı bulunmuyor.",
      badge: "info",
    };
  }

  const currentMaxWeight = Math.max(...sets.map((s) => s.weightKg));
  const isTargetMetAllSets = sets.every((s) => s.reps >= s.targetRepMax);

  if (isTargetMetAllSets) {
    const nextWeight = Math.round((currentMaxWeight + incrementKg) * 10) / 10;
    return {
      isTargetMetAllSets: true,
      currentMaxWeight,
      recommendedNextWeightKg: nextWeight,
      message: `Tüm çalışma setlerinde üst tekrar sınırına (${sets[0].targetRepMax} tekrar) ulaştınız! Bir sonraki seans için kontrollü bir şekilde +${incrementKg} kg (${nextWeight} kg) artırmayı deneyebilirsiniz.`,
      badge: "progression",
    };
  }

  const allWithinRange = sets.every((s) => s.reps >= s.targetRepMin);
  if (allWithinRange) {
    return {
      isTargetMetAllSets: false,
      currentMaxWeight,
      recommendedNextWeightKg: currentMaxWeight,
      message: `Harika bir efor! Belirlenen tekrar aralığı içindesiniz. Bir sonraki seansta aynı ağırlıkla (${currentMaxWeight} kg) devam edip tekrarları kademeli artırmaya odaklanabilirsiniz.`,
      badge: "maintain",
    };
  }

  return {
    isTargetMetAllSets: false,
    currentMaxWeight,
    recommendedNextWeightKg: currentMaxWeight,
    message: `Vücudunu dinlemek gelişimin en önemli parçasıdır. Bir sonraki seansta aynı ağırlığı (${currentMaxWeight} kg) koruyarak hareket formuna ve dinlenmeye odaklanmak en güvenli yoldur.`,
    badge: "maintain",
  };
}
