import { describe, it, expect } from "vitest";
import {
  mapOpenGymWorkoutToRutinFit,
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


  it("getOpenGymDataDir çevre değişkenini önceliklendirmeli ve getOpenGymLocalState asenkron okumalı", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    const { getOpenGymDataDir, getOpenGymLocalState, syncWeightsToOpenGymState } = await import(
      "../src/lib/opengym-client"
    );

    const tmpDir = path.join(os.tmpdir(), `opengym_test_${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    process.env.OPENGYM_DATA_DIR = tmpDir;

    try {
      expect(getOpenGymDataDir()).toBe(tmpDir);

      // Başlangıçta state dosyası yokken null dönmeli
      const emptyState = await getOpenGymLocalState();
      expect(emptyState).toBeNull();

      // State dosyası oluştur
      const stateFilePath = path.join(tmpDir, "state-mock.json");
      const sampleState = {
        workouts: [{ id: "w1", date: "2026-10-18", name: "Göğüs", exercises: [] }],
        bodyWeight: [{ date: "2026-10-17", weight: 112.0 }],
      };
      fs.writeFileSync(stateFilePath, JSON.stringify(sampleState, null, 2), "utf-8");

      // Asenkron okuma doğrulaması
      const readState = await getOpenGymLocalState();
      expect(readState).not.toBeNull();
      expect(readState?.workouts?.length).toBe(1);
      expect(readState?.bodyWeight?.length).toBe(1);

      // Kilo senkronizasyonu doğrulaması (tekrar eden tarih eklenmemeli, yeni tarih eklenmeli)
      const newWeights = [
        { date: "2026-10-17", weightKg: 112.0 }, // Mevcut
        { date: "2026-10-18", weightKg: 111.5 }, // Yeni
      ];
      const added = await syncWeightsToOpenGymState(newWeights);
      expect(added).toBe(1);

      const updatedState = await getOpenGymLocalState();
      expect(updatedState?.bodyWeight?.length).toBe(2);
      expect(updatedState?.bodyWeight?.[1]).toEqual({ date: "2026-10-18", weight: 111.5 });
    } finally {
      delete process.env.OPENGYM_DATA_DIR;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

