/** Ölçü birimi normalizasyonu ve dönüşümü (kiler, alışveriş listesi, tarifler). */

export type CanonicalUnit = "g" | "kg" | "ml" | "l" | "adet" | "paket" | string;

const ALIASES: Record<string, CanonicalUnit> = {
  g: "g",
  gr: "g",
  gram: "g",
  kg: "kg",
  kilo: "kg",
  kilogram: "kg",
  ml: "ml",
  mililitre: "ml",
  l: "l",
  lt: "l",
  litre: "l",
  liter: "l",
  adet: "adet",
  ad: "adet",
  tane: "adet",
  paket: "paket",
  pkt: "paket",
};

/** Kullanıcının yazdığı birimi (gr, Lt, Kilo...) kanonik biçime çevirir. */
export function normalizeUnit(unit: string | null | undefined): CanonicalUnit {
  const key = (unit ?? "g").trim().toLocaleLowerCase("tr-TR");
  return ALIASES[key] ?? key;
}

/** Her kanonik birimin temel birime çarpanı: ağırlık → g, hacim → ml. */
const BASE: Record<string, { dimension: "mass" | "volume"; factor: number }> = {
  g: { dimension: "mass", factor: 1 },
  kg: { dimension: "mass", factor: 1000 },
  ml: { dimension: "volume", factor: 1 },
  l: { dimension: "volume", factor: 1000 },
};

/**
 * Miktarı bir birimden diğerine çevirir. Ağırlık ↔ hacim ↔ adet arası dönüşüm
 * yapılmaz (yoğunluk bilinmez), isCompatible=false döner.
 */
export function convertUnitAmount(
  amount: number,
  fromUnit: string = "g",
  toUnit: string = "g"
): { convertedAmount: number; isCompatible: boolean } {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return { convertedAmount: amount, isCompatible: true };

  const a = BASE[from];
  const b = BASE[to];
  if (!a || !b || a.dimension !== b.dimension) {
    return { convertedAmount: amount, isCompatible: false };
  }
  // Kayan nokta gürültüsünü (0.30000000000000004) temizle
  const converted = Math.round(((amount * a.factor) / b.factor) * 1e6) / 1e6;
  return { convertedAmount: converted, isCompatible: true };
}
