/** Standart olimpik plakalar (kg), büyükten küçüğe. */
export const PLATE_WEIGHTS = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

export interface PlateCount {
  weight: number;
  count: number;
}

/**
 * Hedef toplam ağırlık için bir tarafa takılacak plakalar. Kalan (tam karşılanamayan)
 * ağırlık `remainder` olarak döner.
 */
export function platesPerSide(target: number, bar: number, collar = 0): { perSideWeight: number; plates: PlateCount[]; remainder: number } {
  const net = target - bar - collar * 2;
  if (net <= 0) return { perSideWeight: 0, plates: [], remainder: 0 };
  const perSideWeight = net / 2;
  let remaining = perSideWeight;
  const plates: PlateCount[] = [];
  for (const weight of PLATE_WEIGHTS) {
    if (remaining >= weight) {
      const count = Math.floor(remaining / weight);
      plates.push({ weight, count });
      remaining = Math.round((remaining - count * weight) * 100) / 100;
    }
  }
  return { perSideWeight, plates, remainder: remaining };
}
