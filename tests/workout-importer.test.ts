import { describe, it, expect } from "vitest";
import { parseWorkoutCsv } from "../src/lib/workout-importer";

describe("Workout Importer (Strong & Hevy CSV)", () => {
  it("Strong CSV formatını başarıyla ayrıştırmalı", () => {
    const strongCsv = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2026-10-15 19:40:00,Ağırlık A (İtme),42m,Bench Press,1,60,10,,,,,7
2026-10-15 19:40:00,Ağırlık A (İtme),42m,Bench Press,2,60,10,,,,,8
2026-10-15 19:40:00,Ağırlık A (İtme),42m,Overhead Press,1,40,8,,,,,7.5`;

    const result = parseWorkoutCsv(strongCsv);
    expect(result.success).toBe(true);
    expect(result.appType).toBe("strong");
    expect(result.workoutCount).toBe(1);
    expect(result.totalSetsCount).toBe(3);

    const workout = result.workouts[0];
    expect(workout.date).toBe("2026-10-15");
    expect(workout.name).toBe("Ağırlık A (İtme)");
    expect(workout.sets[0].exerciseName).toBe("Bench Press");
    expect(workout.sets[0].weightKg).toBe(60);
    expect(workout.sets[0].reps).toBe(10);
    expect(workout.sets[0].rpe).toBe(7);
  });

  it("Hevy CSV formatını başarıyla ayrıştırmalı", () => {
    const hevyCsv = `Date,Workout Name,Exercise Title,Set Index,Set Type,Weight_kg,Reps,RPE,Notes
2026-10-16 18:30:00,Bacak & Çekiş,Squat,1,normal,90,8,8,
2026-10-16 18:30:00,Bacak & Çekiş,Squat,2,normal,90,8,8.5,
2026-10-16 18:30:00,Bacak & Çekiş,Lat Pulldown,1,normal,55,10,7,`;

    const result = parseWorkoutCsv(hevyCsv);
    expect(result.success).toBe(true);
    expect(result.appType).toBe("hevy");
    expect(result.workoutCount).toBe(1);
    expect(result.totalSetsCount).toBe(3);
    expect(result.workouts[0].sets[0].exerciseName).toBe("Squat");
    expect(result.workouts[0].sets[0].weightKg).toBe(90);
  });

  it("Geçersiz CSV durumunda hata döndürmeli", () => {
    const invalidCsv = "invalid,header,only\n1,2,3";
    const result = parseWorkoutCsv(invalidCsv);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });
});
