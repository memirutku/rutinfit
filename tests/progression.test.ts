import { describe, it, expect } from "vitest";
import { evaluateExerciseProgression } from "../src/lib/progression";

describe("Egzersiz İlerleme Algoritması", () => {
  it("Tüm setlerde üst tekrar sınırına ulaşıldığında +2.5 kg artış önermeli", () => {
    const sets = [
      { setNumber: 1, weightKg: 60, reps: 10, targetRepMin: 8, targetRepMax: 10 },
      { setNumber: 2, weightKg: 60, reps: 10, targetRepMin: 8, targetRepMax: 10 },
      { setNumber: 3, weightKg: 60, reps: 10, targetRepMin: 8, targetRepMax: 10 },
    ];

    const result = evaluateExerciseProgression(sets, 2.5);
    expect(result.isTargetMetAllSets).toBe(true);
    expect(result.recommendedNextWeightKg).toBe(62.5);
    expect(result.badge).toBe("progression");
    // B23: mesajdaki ağırlıklar Türkçe ondalıkla
    expect(result.message).toContain("+2,5 kg (62,5 kg) artırmayı deneyebilirsiniz");
  });

  it("Hedef aralığında kalındığında aynı ağırlığı korumayı ve suçlayıcı olmamayı önermeli", () => {
    const sets = [
      { setNumber: 1, weightKg: 60, reps: 10, targetRepMin: 8, targetRepMax: 10 },
      { setNumber: 2, weightKg: 60, reps: 9, targetRepMin: 8, targetRepMax: 10 },
      { setNumber: 3, weightKg: 60, reps: 8, targetRepMin: 8, targetRepMax: 10 },
    ];

    const result = evaluateExerciseProgression(sets);
    expect(result.isTargetMetAllSets).toBe(false);
    expect(result.recommendedNextWeightKg).toBe(60);
    expect(result.badge).toBe("maintain");
    expect(result.message).toContain("aynı ağırlıkla (60 kg) devam edip");
  });

  it("Hedefin altında kalındığında ağırlığı otomatik düşürmemeli, dinlenmeyi teşvik etmeli", () => {
    const sets = [
      { setNumber: 1, weightKg: 60, reps: 8, targetRepMin: 8, targetRepMax: 10 },
      { setNumber: 2, weightKg: 60, reps: 7, targetRepMin: 8, targetRepMax: 10 },
      { setNumber: 3, weightKg: 60, reps: 6, targetRepMin: 8, targetRepMax: 10 },
    ];

    const result = evaluateExerciseProgression(sets);
    expect(result.isTargetMetAllSets).toBe(false);
    expect(result.recommendedNextWeightKg).toBe(60); // Ağırlık düşürülmedi!
    expect(result.badge).toBe("maintain");
    expect(result.message).toContain("aynı ağırlığı (60 kg) koruyarak");
  });

  it("B23: korunacak ağırlık da virgüllü ondalıkla yazılır", () => {
    const sets = [{ setNumber: 1, weightKg: 102.5, reps: 4, targetRepMin: 6, targetRepMax: 8 }];
    expect(evaluateExerciseProgression(sets).message).toContain("(102,5 kg)");
    expect(evaluateExerciseProgression([{ ...sets[0], reps: 6 }]).message).toContain("(102,5 kg)");
    expect(evaluateExerciseProgression([{ ...sets[0], reps: 8 }], 1.25).message).toContain("+1,25 kg (103,75 kg)");
  });
});
