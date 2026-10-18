import { describe, it, expect } from "vitest";
import {
  mapOpenGymWorkoutToRutinFit,
  mapRutinFitWeightsToOpenGym,
  OpenGymWorkout,
} from "../src/lib/opengym-client";

describe("openGym Entegrasyon ve Veri Eşleme", () => {
  it("openGym antrenman nesnesini RutinFit seans formatına dönüştürmeli", () => {
    const ogWorkout: OpenGymWorkout = {
      id: "og-workout-1",
      date: "2026-10-18",
      name: "Push Day (Ağırlık A)",
      durationSeconds: 2400, // 40 dakika
      notes: "Göğüs ve omuz odaklı",
      exercises: [
        {
          exerciseId: "bench-press",
          name: "Bench Press",
          sets: [
            { weight: 70, reps: 10, rpe: 8 },
            { weight: 70, reps: 10, rpe: 8 },
            { weight: 72.5, reps: 8, rpe: 9 },
          ],
        },
        {
          exerciseId: "lateral-raise",
          name: "Lateral Raise",
          sets: [
            { weight: 12, reps: 15, rpe: 7 },
            { weight: 12, reps: 15, rpe: 8 },
          ],
        },
      ],
    };

    const mapped = mapOpenGymWorkoutToRutinFit(ogWorkout);

    expect(mapped.date).toBe("2026-10-18");
    expect(mapped.name).toBe("Push Day (Ağırlık A)");
    expect(mapped.durationMinutes).toBe(40);
    expect(mapped.completed).toBe(true);
    expect(mapped.setLogs.length).toBe(5);

    // Bench press setleri
    expect(mapped.setLogs[0].exerciseName).toBe("Bench Press");
    expect(mapped.setLogs[0].weightKg).toBe(70);
    expect(mapped.setLogs[0].reps).toBe(10);
    expect(mapped.setLogs[0].isTargetMet).toBe(true);

    // Lateral raise seti
    expect(mapped.setLogs[3].exerciseName).toBe("Lateral Raise");
    expect(mapped.setLogs[3].weightKg).toBe(12);
  });

  it("RutinFit kilo kayıtlarını openGym bodyWeight formatına dönüştürmeli", () => {
    const rfWeights = [
      { date: "2026-10-17", weightKg: 112.4 },
      { date: "2026-10-18", weightKg: 111.9 },
    ];

    const ogWeights = mapRutinFitWeightsToOpenGym(rfWeights);

    expect(ogWeights.length).toBe(2);
    expect(ogWeights[0]).toEqual({ date: "2026-10-17", weight: 112.4 });
    expect(ogWeights[1]).toEqual({ date: "2026-10-18", weight: 111.9 });
  });
});
