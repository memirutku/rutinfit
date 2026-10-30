import { describe, expect, it } from "vitest";
import { foldTr, rankFoods, type FoodUsage } from "@/lib/food-search";

const food = (id: string, name: string, extra: Partial<{ brand: string | null; source: string; confidence: string }> = {}) => ({
  id,
  name,
  brand: null,
  source: "Katalog",
  confidence: "Yüksek",
  ...extra,
});

describe("F02: Türkçe harf katlama", () => {
  it("ç ğ ı i̇ ö ş ü harflerini düz Latin harfe indirir, küçük harfe çevirir", () => {
    expect(foldTr("Şeker ÇİLEK Iğdır Göğüs Üzüm")).toBe("seker cilek igdir gogus uzum");
  });
});

describe("F02: arama sıralaması", () => {
  const foods = [food("1", "İnek Sütü"), food("2", "Süt (%1.5 yarım yağlı)"), food("3", "Sütlaç"), food("4", "Yulaf Ezmesi"), food("5", "Tavuk Göğsü (çiğ)")];

  it("Türkçe karakter yazmadan bulur; baştan eşleşme kelime başından, o da içerikten önce gelir", () => {
    expect(rankFoods(foods, "sut").map((f) => f.id)).toEqual(["2", "3", "1"]);
  });

  it("çok kelimeli aramada her kelime bulunmalı", () => {
    expect(rankFoods(foods, "tavuk gogus").map((f) => f.id)).toEqual(["5"]);
    expect(rankFoods(foods, "tavuk yulaf")).toEqual([]);
  });

  it("eşit eşleşmede sık ve yakın zamanda kullanılan önce gelir", () => {
    const usage = new Map<string, FoodUsage>([
      ["1", { count: 1, lastDate: "2026-06-01" }],
      ["3", { count: 6, lastDate: "2026-10-29" }],
    ]);
    // "süt" ile 2 ve 3 baştan eşleşir; 3 çok kullanıldığı için öne geçer.
    expect(rankFoods(foods, "süt", usage, "2026-10-30").map((f) => f.id)).toEqual(["3", "2", "1"]);
  });

  it("doğrulanmış kaynak tahmini kaydın önüne geçer", () => {
    const list = [food("a", "Simit", { source: "RutinFit", confidence: "Tahmini" }), food("b", "Simit (Fırın)", { confidence: "Yüksek" })];
    expect(rankFoods(list, "simit").map((f) => f.id)).toEqual(["b", "a"]);
  });

  it("boş aramada önce kullanım, sonra Türk alfabesi", () => {
    const usage = new Map<string, FoodUsage>([["4", { count: 3, lastDate: "2026-10-29" }]]);
    expect(rankFoods(foods, "", usage, "2026-10-30").map((f) => f.id)).toEqual(["4", "1", "2", "3", "5"]);
  });

  it("markada da arar", () => {
    expect(rankFoods([food("x", "Granola", { brand: "Eti" })], "eti").map((f) => f.id)).toEqual(["x"]);
  });
});
