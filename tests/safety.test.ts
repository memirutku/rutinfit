import { describe, expect, it } from "vitest";
import { calorieFloor, checkCalorieTarget, detectRedFlags, maxWeeklyLossKg, SAFETY_REFERRAL_TR } from "@/lib/safety";

describe("F56: kalori tabanı ve kilo kaybı hızı", () => {
  it("cinsiyete göre taban: kadın 1200, erkek 1500 kcal", () => {
    expect(calorieFloor("female")).toBe(1200);
    expect(calorieFloor("male")).toBe(1500);
    expect(calorieFloor("bilinmiyor")).toBe(1200);
  });

  it("haftalık azami kayıp vücut ağırlığının %1'i, 0,05 kg'a aşağı yuvarlanır", () => {
    expect(maxWeeklyLossKg(112)).toBe(1.1);
    expect(maxWeeklyLossKg(60)).toBe(0.6);
  });

  it("tabanın altındaki hedef reddedilir ve nedeni söylenir", () => {
    expect(checkCalorieTarget("male", 1500).ok).toBe(true);
    const low = checkCalorieTarget("male", 1400);
    expect(low.ok).toBe(false);
    expect(low.floor).toBe(1500);
    expect(low.message).toMatch(/1\.500 kcal/);
  });
});

describe("F56: kırmızı bayraklar", () => {
  it.each([
    "yemekten sonra kendimi kusturuyorum",
    "Yedikten sonra kusuyorum",
    "laksatif kullanmaya başladım",
    "günlerdir hiç yemek yemedim",
    "günde 500 kalori ile zayıflamak istiyorum",
    "tıkınırcasına yiyip pişman oluyorum",
    "kendime zarar vermek istiyorum",
  ])("yakalar: %s", (text) => {
    expect(detectRedFlags(text)).toBe(true);
  });

  it.each(["bugün 2000 kalori yedim", "bebeğim kustu, ne yedirmeliyim?", "kahvaltıda 350 kalorilik yulaf yedim"])(
    "yakalamaz: %s",
    (text) => {
      expect(detectRedFlags(text)).toBe(false);
    }
  );

  it("yönlendirme metni profesyonel desteği ve acil numarayı içerir", () => {
    expect(SAFETY_REFERRAL_TR).toMatch(/doktor|diyetisyen|uzman/);
    expect(SAFETY_REFERRAL_TR).toContain("112");
  });
});
