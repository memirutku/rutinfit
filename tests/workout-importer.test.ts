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

describe("H1: ağırlık başlıklarındaki birimler", () => {
  it("Strong'un 'Weight (kg)' başlığını tanır ve uyarı vermez", () => {
    const csv = "Date,Workout Name,Exercise Name,Set Order,Weight (kg),Reps\n2026-10-15 19:40:00,A,Bench Press,1,62.5,8";
    const r = parseWorkoutCsv(csv);
    expect(r.workouts[0].sets[0].weightKg).toBe(62.5);
    expect(r.warnings).toEqual([]);
  });

  it("Hevy'nin weight_lbs ve Strong'un 'Weight (lbs)' değerlerini kg'a çevirir (0,1 kg hassasiyet)", () => {
    const hevy = [
      "title,start_time,end_time,exercise_title,set_index,set_type,weight_lbs,reps,rpe",
      'Push,"16 Oct 2026, 18:30","16 Oct 2026, 19:20",Bench Press,0,normal,135,8,8.5',
    ].join("\n");
    const h = parseWorkoutCsv(hevy).workouts[0].sets[0];
    expect(h.weightKg).toBe(61.2);
    expect(h.rpe).toBe(8.5);

    const strong = "Date,Workout Name,Exercise Name,Set Order,Weight (lbs),Reps\n2026-10-15,A,Squat,1,225,5";
    expect(parseWorkoutCsv(strong).workouts[0].sets[0].weightKg).toBe(102.1);
  });

  it("ağırlık sütunu yoksa setleri aktarır ama açıkça uyarır", () => {
    const csv = "Date,Workout Name,Exercise Name,Set Order,Reps\n2026-10-15,A,Push Up,1,15";
    const r = parseWorkoutCsv(csv);
    expect(r.success).toBe(true);
    expect(r.workouts[0].sets[0].weightKg).toBe(0);
    expect(r.warnings).toEqual([expect.stringMatching(/ağırlık sütunu bulunamadı/i)]);
  });
});

describe("H2: aktarılamayan bilgiler kaybolmaz", () => {
  const hevy = [
    "title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe",
    'Push,"16 Oct 2026, 18:30","16 Oct 2026, 19:20",Güzel seans,Bench Press,1,Dirsek ağrısı,0,warmup,40,10,,,',
    'Push,"16 Oct 2026, 18:30","16 Oct 2026, 19:20",Güzel seans,Bench Press,1,Dirsek ağrısı,1,normal,80,8,,30,8',
    'Push,"16 Oct 2026, 18:30","16 Oct 2026, 19:20",Güzel seans,Plank,,,0,normal,0,1,,60,',
  ].join("\n");

  it("dolu olup aktarılamayan sütunları ve atlanan ısınma setlerini raporlar", () => {
    const r = parseWorkoutCsv(hevy);
    expect(r.totalSetsCount).toBe(2);
    expect(r.skippedWarmupSets).toBe(1);
    // distance_km hiç dolu değil: raporlanmaz.
    expect(r.ignoredColumns).toEqual(["superset_id", "duration_seconds"]);
  });

  it("seans açıklaması ve egzersiz notları (tekrarsız) seans notuna yazılır", () => {
    const notes = parseWorkoutCsv(hevy).workouts[0].notes ?? "";
    expect(notes).toContain("Güzel seans");
    expect(notes.match(/Bench Press: Dirsek ağrısı/g)).toHaveLength(1);
  });

  it("Strong'da set notu ve antrenman notu seans notuna yazılır; boş sütunlar raporlanmaz", () => {
    const csv = [
      "Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE",
      "2026-10-15 19:40:00,A,42m,Squat,1,100,5,,,Derin indim,Bacaklar yorgun,",
    ].join("\n");
    const r = parseWorkoutCsv(csv);
    expect(r.workouts[0].notes).toContain("Bacaklar yorgun");
    expect(r.workouts[0].notes).toContain("Squat: Derin indim");
    expect(r.ignoredColumns).toEqual([]);
  });
});
