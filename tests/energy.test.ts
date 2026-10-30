import { describe, expect, it } from "vitest";
import { ACTIVITY_LEVELS, bmrMifflin, planTargets, type EnergyInput } from "@/lib/energy";

const me: EnergyInput = {
  sex: "male",
  age: 25,
  heightCm: 181,
  weightKg: 112,
  activityLevel: "light",
  goalType: "lose",
  goalRateKgPerWeek: 0.5,
  targetWeightKg: 90,
};

describe("F09: Mifflin-St Jeor ve TDEE", () => {
  it("BMR formülü: erkek +5, kadın −161", () => {
    expect(bmrMifflin({ sex: "male", age: 25, heightCm: 181, weightKg: 112 })).toBeCloseTo(2131.25, 2);
    expect(bmrMifflin({ sex: "female", age: 30, heightCm: 165, weightKg: 70 })).toBeCloseTo(1420.25, 2);
  });

  it("aktivite katsayıları 1,2 ile 1,9 arasında ve sıralı", () => {
    const factors = Object.values(ACTIVITY_LEVELS).map((a) => a.factor);
    expect(factors).toEqual([1.2, 1.375, 1.55, 1.725, 1.9]);
  });
});

describe("F09: hedef planı", () => {
  it("kilo verme: TDEE − (hız × 7700 / 7), 10'a yuvarlanır; makrolar ve tahmini varış tarihi", () => {
    const p = planTargets(me, "2026-10-30");
    expect(p.tdee).toBe(2930);
    expect(p.calorieTarget).toBe(2380);
    expect(p.calorieCeiling).toBe(2480);
    // Protein: 1,8 g × hedef kilo (90).
    expect(p.proteinTargetG).toBe(162);
    expect(p.fatTargetG).toBe(71);
    expect(p.carbTargetG).toBe(Math.round((2380 - 162 * 4 - 71 * 9) / 4));
    // 22 kg / 0,5 kg = 44 hafta.
    expect(p.weeksToGoal).toBe(44);
    expect(p.etaDate).toBe("2027-09-03");
    expect(p.rateCapped).toBe(false);
  });

  it("F56: hız vücut ağırlığının %1'iyle sınırlanır ve not düşülür", () => {
    const p = planTargets({ ...me, sex: "female", age: 30, heightCm: 165, weightKg: 60, activityLevel: "active", goalRateKgPerWeek: 1.5, targetWeightKg: 55 }, "2026-10-30");
    expect(p.floorApplied).toBe(false);
    expect(p.rateKgPerWeek).toBe(0.6);
    expect(p.rateCapped).toBe(true);
    expect(p.notes.join(" ")).toMatch(/0,6 kg/);
  });

  it("F56: kalori tabanın altına inmez; tabanda kayıp beklenmiyorsa varış tarihi verilmez", () => {
    const p = planTargets(
      { sex: "female", age: 60, heightCm: 150, weightKg: 50, activityLevel: "sedentary", goalType: "lose", goalRateKgPerWeek: 1, targetWeightKg: 45 },
      "2026-10-30"
    );
    expect(p.calorieTarget).toBe(1200);
    expect(p.floorApplied).toBe(true);
    expect(p.etaDate).toBeNull();
    expect(p.notes.join(" ")).toMatch(/uzman/);
  });

  it("koruma: hedef TDEE'dir; alma: en çok haftada 0,5 kg", () => {
    expect(planTargets({ ...me, goalType: "maintain" }, "2026-10-30").calorieTarget).toBe(2930);
    const gain = planTargets({ ...me, goalType: "gain", goalRateKgPerWeek: 1, targetWeightKg: 120 }, "2026-10-30");
    expect(gain.rateKgPerWeek).toBe(0.5);
    expect(gain.calorieTarget).toBe(3480);
  });

  it("hedef kilo yoksa protein, BMI 25'teki kiloya göre (fazla kilolu kullanıcıda) hesaplanır", () => {
    const p = planTargets({ ...me, targetWeightKg: null }, "2026-10-30");
    expect(p.proteinTargetG).toBe(Math.round(1.8 * 25 * 1.81 * 1.81));
    expect(p.etaDate).toBeNull();
  });
});
