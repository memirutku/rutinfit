import { describe, expect, it } from "vitest";
import { formatAmount, formatDateTr, formatNumberTr, pantryStep, parseDecimalTr, formatDecimalTr, formatKg } from "@/lib/format";
import { compareTr } from "@/lib/text";

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

describe("F80: parseDecimalTr", () => {
  it("virgül ve noktayı ondalık ayracı olarak okur", () => {
    expect(parseDecimalTr("62,5")).toBe(62.5);
    expect(parseDecimalTr("62.5")).toBe(62.5);
    expect(parseDecimalTr(" 1 500 ")).toBe(1500);
    expect(parseDecimalTr("80")).toBe(80);
  });

  it("ikisi birlikteyse nokta binlik, virgül ondalık sayılır", () => {
    expect(parseDecimalTr("1.234,5")).toBe(1234.5);
    expect(parseDecimalTr("1,234.5")).toBe(1234.5);
  });

  it("yarım yazılmış ya da geçersiz girişte null döner", () => {
    expect(parseDecimalTr("")).toBeNull();
    expect(parseDecimalTr(",")).toBeNull();
    expect(parseDecimalTr("abc")).toBeNull();
    expect(parseDecimalTr("62,")).toBe(62);
  });
});

describe("F80: formatDateTr", () => {
  it("YYYY-MM-DD → gg.aa.yyyy; kısa biçim gg.aa", () => {
    expect(formatDateTr("2026-10-30")).toBe("30.10.2026");
    expect(formatDateTr("2026-01-05", { short: true })).toBe("05.01");
  });

  it("geçersiz girişi olduğu gibi bırakır", () => {
    expect(formatDateTr("dün")).toBe("dün");
    expect(formatDateTr(null)).toBe("");
  });
});

describe("F80: compareTr", () => {
  it("Türk alfabesine göre sıralar (Ç, Ğ, I/İ, Ö, Ş, Ü yerinde)", () => {
    const names = ["Zeytin", "Şeftali", "İncir", "Ispanak", "Elma", "Çilek", "Üzüm", "Cevİz", "ceviz"];
    expect([...names].sort(compareTr)).toEqual(["Cevİz", "ceviz", "Çilek", "Elma", "Ispanak", "İncir", "Şeftali", "Üzüm", "Zeytin"]);
  });
});

describe("B23: ağırlık ve ondalık biçimi (en fazla iki ondalık, gereksiz sıfırsız)", () => {
  it("formatDecimalTr iki ondalığa kadar gösterir, binlik ayracı nokta, ondalık virgül", () => {
    expect(formatDecimalTr(1.25)).toBe("1,25");
    expect(formatDecimalTr(61.25)).toBe("61,25");
    expect(formatDecimalTr(61.3)).toBe("61,3");
    expect(formatDecimalTr(100)).toBe("100");
    expect(formatDecimalTr(100.0)).toBe("100");
    expect(formatDecimalTr(1500)).toBe("1.500");
    expect(formatDecimalTr(3320.5)).toBe("3.320,5");
    expect(formatDecimalTr(0.5)).toBe("0,5");
    expect(formatDecimalTr(-2.5)).toBe("-2,5");
    expect(formatDecimalTr(116.666)).toBe("116,67");
    expect(formatDecimalTr(116.666, 1)).toBe("116,7");
  });

  it("formatKg birimle döner; geçersiz değerde tire", () => {
    expect(formatKg(1.25)).toBe("1,25 kg");
    expect(formatKg(142.5)).toBe("142,5 kg");
    expect(formatKg(Number.NaN)).toBe("—");
    expect(formatKg(null)).toBe("—");
  });

  it("eski formatNumberTr davranışı değişmez (tek ondalık)", () => {
    expect(formatNumberTr(1.25)).toBe("1,3");
    expect(formatNumberTr(1500)).toBe("1.500");
  });
});
