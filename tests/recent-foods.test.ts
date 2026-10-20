import { describe, it, expect } from "vitest";
import { pushRecentFood, parseRecentFoods } from "@/lib/recent-foods";

const f = (id: string, defaultGrams = 100) => ({ id, name: `Besin ${id}`, defaultGrams });

describe("pushRecentFood", () => {
  it("yeni besini başa koyar ve en fazla 5 öğe tutar", () => {
    const list = ["1", "2", "3", "4", "5"].map((id) => f(id));
    const next = pushRecentFood(list, f("6", 15));
    expect(next.map((r) => r.id)).toEqual(["6", "1", "2", "3", "4"]);
  });

  it("var olan besini kopyalamadan başa taşır ve son gramajı kullanır", () => {
    const next = pushRecentFood([f("1"), f("2", 200), f("3")], f("2", 220));
    expect(next.map((r) => r.id)).toEqual(["2", "1", "3"]);
    expect(next[0].defaultGrams).toBe(220);
  });

  it("girdiyi değiştirmez", () => {
    const list = [f("1")];
    pushRecentFood(list, f("2"));
    expect(list).toEqual([f("1")]);
  });
});

describe("parseRecentFoods", () => {
  it("bozuk JSON, null veya dizi olmayan değer için boş liste döner", () => {
    expect(parseRecentFoods(null)).toEqual([]);
    expect(parseRecentFoods("{bozuk")).toEqual([]);
    expect(parseRecentFoods('{"id":"1"}')).toEqual([]);
  });

  it("geçersiz öğeleri ayıklar, fazlasını keser", () => {
    const raw = JSON.stringify([f("1"), { id: 2 }, null, { id: "3", name: "x", defaultGrams: -1 }, f("4"), f("5"), f("6"), f("7"), f("8")]);
    expect(parseRecentFoods(raw).map((r) => r.id)).toEqual(["1", "4", "5", "6", "7"]);
  });
});
