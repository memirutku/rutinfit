import { describe, expect, it } from "vitest";
import { formatAmount, formatNumberTr, pantryStep } from "@/lib/format";

describe("formatAmount", () => {
  it("gramı 1000 üstünde kilograma çevirir ve Türkçe ondalık kullanır", () => {
    expect(formatAmount(1500, "g")).toBe("1,5 kg");
    expect(formatAmount(750, "gr")).toBe("750 g");
    expect(formatAmount(2250, "ml")).toBe("2,3 l");
    expect(formatAmount(3, "Adet")).toBe("3 adet");
  });

  it("binlik ayracı nokta, ondalık virgül", () => {
    expect(formatNumberTr(1234.5)).toBe("1.234,5");
  });
});

describe("pantryStep", () => {
  it("birime göre makul adım verir", () => {
    expect(pantryStep("g")).toBe(50);
    expect(pantryStep("kg")).toBe(0.1);
    expect(pantryStep("adet")).toBe(1);
    expect(pantryStep("paket")).toBe(1);
  });
});
