import { describe, expect, it } from "vitest";
import { parseFoodText, splitFoodText } from "@/lib/natural-log";

describe("F06: doğal dille yazılan öğün", () => {
  it("parçalara ayırır: virgül, 've', '+', satır", () => {
    expect(splitFoodText("1 kase mercimek çorbası, 2 dilim ekmek ve yarım bardak ayran\n3 yumurta + çay")).toEqual([
      "1 kase mercimek çorbası",
      "2 dilim ekmek",
      "yarım bardak ayran",
      "3 yumurta",
      "çay",
    ]);
  });

  it.each([
    ["1 kase mercimek çorbası", { quantity: 1, unit: "kase", food: "mercimek çorbası" }],
    ["2 dilim ekmek", { quantity: 2, unit: "dilim", food: "ekmek" }],
    ["yarım su bardağı süt", { quantity: 0.5, unit: "su bardağı", food: "süt" }],
    ["yarım bardak ayran", { quantity: 0.5, unit: "su bardağı", food: "ayran" }],
    ["bir buçuk porsiyon bulgur pilavı", { quantity: 1.5, unit: "porsiyon", food: "bulgur pilavı" }],
    ["150 gr tavuk göğsü", { quantity: 150, unit: "gram", food: "tavuk göğsü" }],
    ["150g yoğurt", { quantity: 150, unit: "gram", food: "yoğurt" }],
    ["2 yemek kaşığı zeytinyağı", { quantity: 2, unit: "yemek kaşığı", food: "zeytinyağı" }],
    ["1,5 tabak menemen", { quantity: 1.5, unit: "porsiyon", food: "menemen" }],
    ["3 yumurta", { quantity: 3, unit: null, food: "yumurta" }],
    ["iki tane simit", { quantity: 2, unit: "adet", food: "simit" }],
    ["lahmacun", { quantity: 1, unit: null, food: "lahmacun" }],
    ["tavuk göğsü 200 gr", { quantity: 200, unit: "gram", food: "tavuk göğsü" }],
  ])("%s", (text, expected) => {
    expect(parseFoodText(text)).toEqual(expected);
  });
});
