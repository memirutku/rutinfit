import { describe, expect, it } from "vitest";
import { convertUnitAmount, normalizeUnit } from "@/lib/units";

describe("normalizeUnit", () => {
  it.each([
    ["gr", "g"],
    ["Gram", "g"],
    ["KG", "kg"],
    ["kilo", "kg"],
    ["lt", "l"],
    ["Litre", "l"],
    ["mL", "ml"],
    ["Adet", "adet"],
    ["  g ", "g"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeUnit(input)).toBe(expected);
  });
});

describe("convertUnitAmount", () => {
  it("takma adlar arasında dönüşüm uyumlu sayılır", () => {
    expect(convertUnitAmount(250, "g", "gr")).toEqual({ convertedAmount: 250, isCompatible: true });
    expect(convertUnitAmount(1.5, "lt", "ml")).toEqual({ convertedAmount: 1500, isCompatible: true });
    expect(convertUnitAmount(750, "ml", "litre")).toEqual({ convertedAmount: 0.75, isCompatible: true });
    expect(convertUnitAmount(2, "kg", "gram")).toEqual({ convertedAmount: 2000, isCompatible: true });
  });

  it("ağırlık ↔ hacim ↔ adet uyumsuzdur", () => {
    expect(convertUnitAmount(3, "adet", "g").isCompatible).toBe(false);
    expect(convertUnitAmount(1, "l", "kg").isCompatible).toBe(false);
  });
});
