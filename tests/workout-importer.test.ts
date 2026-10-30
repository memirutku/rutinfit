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

describe("Workout Importer — gerçek dışa aktarım biçimleri", () => {
  it("gerçek Hevy başlığını tanır: egzersiz adı exercise_title, tarih start_time, set_index 0'dan başlar, ısınma atlanır", () => {
    const csv = [
      '"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"',
      '"Bacak Günü","16 Oct 2026, 18:30","16 Oct 2026, 19:20","","Squat (Barbell)","","","0","warmup","40","10","","",""',
      '"Bacak Günü","16 Oct 2026, 18:30","16 Oct 2026, 19:20","","Squat (Barbell)","","","1","normal","90","8","","","8"',
      '"Bacak Günü","16 Oct 2026, 18:30","16 Oct 2026, 19:20","","Squat (Barbell)","","","2","normal","90","7","","","8.5"',
    ].join("\n");

    const r = parseWorkoutCsv(csv);
    expect(r.appType).toBe("hevy");
    expect(r.workoutCount).toBe(1);
    const w = r.workouts[0];
    expect(w).toMatchObject({ date: "2026-10-16", name: "Bacak Günü", durationMinutes: 50 });
    expect(w.sets.map((s) => [s.exerciseName, s.setNumber, s.weightKg, s.reps])).toEqual([
      ["Squat (Barbell)", 1, 90, 8],
      ["Squat (Barbell)", 2, 90, 7],
    ]);
  });

  it("tırnaklı alanda kesme işareti ve kaçışlı çift tırnak sütunları kaydırmaz", () => {
    const csv = [
      "Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE",
      `2026-10-15 19:40:00,"Kol ""Pump"" Günü",42m,Farmer's Walk,1,30,20,,,"not, virgüllü",,`,
    ].join("\n");
    const r = parseWorkoutCsv(csv);
    expect(r.workouts[0].name).toBe('Kol "Pump" Günü');
    expect(r.workouts[0].durationMinutes).toBe(42);
    expect(r.workouts[0].sets[0]).toMatchObject({ exerciseName: "Farmer's Walk", weightKg: 30, reps: 20 });
  });

  it("noktalı virgül ayraçlı ve GG.AA.YYYY tarihli dosyayı okur", () => {
    const csv = "Date;Workout Name;Exercise Name;Set Order;Weight;Reps\n18.10.2026;Sırt;Row;1;50;10";
    const r = parseWorkoutCsv(csv);
    expect(r.workouts[0]).toMatchObject({ date: "2026-10-18", name: "Sırt" });
    expect(r.workouts[0].sets[0]).toMatchObject({ weightKg: 50, reps: 10 });
  });

  it("ondalık virgüllü ağırlığı (62,5) okur", () => {
    const csv = 'Date,Workout Name,Exercise Name,Set Order,Weight,Reps\n2026-10-18,A,Bench,1,"62,5",8';
    expect(parseWorkoutCsv(csv).workouts[0].sets[0].weightKg).toBe(62.5);
  });
});
