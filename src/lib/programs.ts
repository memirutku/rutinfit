/**
 * F18: Hazır programlar. Egzersiz adları kütüphanedekilerle aynıdır. Plank gibi süreli
 * hareketlerde tekrar = saniye. B21: ileri seviye için %1RM'e bağlı 5/3/1 (Wendler).
 */
import { formatDecimalTr } from "./format";
import type { ProgressionResult } from "./progression";
import type { TemplateInput } from "./schemas/workout";

export type ProgramLevel = "Başlangıç" | "Orta" | "İleri";

export interface Program {
  id: string;
  name: string;
  description: string;
  place: "Salon" | "Ev";
  daysPerWeek: number;
  level: ProgramLevel;
  /** B21: uygulanırken 1RM'i sorulan ana kaldırışlar (yalnız %1RM'e bağlı programlarda). */
  oneRepMaxLifts?: string[];
  templates: Array<Omit<TemplateInput, "exercises"> & { exercises: NonNullable<TemplateInput["exercises"]> }>;
}

type Ex = NonNullable<TemplateInput["exercises"]>[number];
const ex = (exerciseName: string, targetSets: number, repMin: number, repMax: number, restSeconds = 90, incrementKg = 2.5): Ex => ({
  exerciseName,
  targetSets,
  repMin,
  repMax,
  restSeconds,
  incrementKg,
});

// ---------------------------------------------------------------- B21: 5/3/1 (Wendler)

/** Haftalık yüzdeler (antrenman maksimumunun) ve tekrarlar. Son set "en az" tekrardır (AMRAP); deload haftası hariç. */
export const WENDLER_WEEKS = [
  { week: 1, label: "5'li hafta", sets: [{ percent: 65, reps: 5 }, { percent: 75, reps: 5 }, { percent: 85, reps: 5 }], amrap: true },
  { week: 2, label: "3'lü hafta", sets: [{ percent: 70, reps: 3 }, { percent: 80, reps: 3 }, { percent: 90, reps: 3 }], amrap: true },
  { week: 3, label: "5/3/1 haftası", sets: [{ percent: 75, reps: 5 }, { percent: 85, reps: 3 }, { percent: 95, reps: 1 }], amrap: true },
  { week: 4, label: "Deload haftası", sets: [{ percent: 40, reps: 5 }, { percent: 50, reps: 5 }, { percent: 60, reps: 5 }], amrap: false },
] as const;

const PLATE_STEP = 2.5;

/** Antrenman maksimumu (TM) = 1RM'in %90'ı, 2,5 kg'a aşağı yuvarlanır. Geçersiz 1RM'de null. */
export function trainingMaxFrom1Rm(oneRepMaxKg: number): number | null {
  if (!(oneRepMaxKg > 0)) return null;
  return Math.floor((oneRepMaxKg * 0.9) / PLATE_STEP + 1e-9) * PLATE_STEP;
}

export interface WendlerSet {
  percent: number;
  weightKg: number;
  reps: number;
  amrap: boolean;
}

/** Haftanın setleri: ağırlık = TM × yüzde, en yakın 2,5 kg'a yuvarlanır. Geçersiz hafta 1. haftadır. */
export function wendlerSets(trainingMaxKg: number, week: number): WendlerSet[] {
  const plan = WENDLER_WEEKS.find((w) => w.week === week) ?? WENDLER_WEEKS[0];
  return plan.sets.map((s, i) => ({
    percent: s.percent,
    weightKg: Math.round((trainingMaxKg * s.percent) / 100 / PLATE_STEP) * PLATE_STEP,
    reps: s.reps,
    amrap: plan.amrap && i === plan.sets.length - 1,
  }));
}

/** Şablondan tamamlanan seans sayısına göre hafta (1–4) ve döngü (0'dan). */
export function wendlerPlan(completedSessions: number): { week: number; cycle: number } {
  const n = Math.max(0, Math.floor(completedSessions || 0));
  return { week: (n % 4) + 1, cycle: Math.floor(n / 4) };
}

/** Her tamamlanan 4 haftalık döngüde TM artar (üst vücut 2,5 kg, alt vücut 5 kg). */
export const cycleTrainingMax = (trainingMaxKg: number, cycle: number, incrementKg: number) => trainingMaxKg + cycle * incrementKg;

/**
 * 5/3/1 seans sonrası öneri: ağırlık seanstan seansa değil döngü sonunda artar. Karar son setin
 * (AMRAP) tekrarına bakar; hedefe ulaşıldıysa döngü planı sürer, ulaşılamadıysa TM düşürülmesi önerilir.
 */
export function wendlerFeedback(
  sets: Array<{ setNumber: number; weightKg: number; reps: number; targetRepMin: number }>,
  incrementKg: number
): ProgressionResult {
  if (sets.length === 0) {
    return { isTargetMetAllSets: false, currentMaxWeight: 0, recommendedNextWeightKg: 0, message: "Henüz set kaydı bulunmuyor.", badge: "info" };
  }
  const ordered = [...sets].sort((a, b) => a.setNumber - b.setNumber);
  const last = ordered[ordered.length - 1];
  const currentMaxWeight = Math.max(...sets.map((s) => s.weightKg));
  const met = last.reps >= last.targetRepMin;
  const inc = formatDecimalTr(incrementKg);
  return {
    isTargetMetAllSets: met,
    currentMaxWeight,
    recommendedNextWeightKg: currentMaxWeight,
    message: met
      ? `5/3/1: son sette ${last.reps} tekrar (hedef en az ${last.targetRepMin}). Plana devam; ağırlıklar antrenman maksimumundan gelir ve döngü sonunda +${inc} kg artar.`
      : `5/3/1: son sette ${last.reps} tekrar (hedef en az ${last.targetRepMin}). Bu kaldırışta antrenman maksimumunu yaklaşık %10 düşürmeyi düşün; şablonu düzenleyerek değiştirebilirsin.`,
    badge: met ? "progression" : "maintain",
  };
}

/** 5/3/1 ana kaldırışı: 3 set, ağırlıklar antrenman maksimumundan. */
const main531 = (exerciseName: string, incrementKg: number, restSeconds = 180): Ex => ({
  ...ex(exerciseName, 3, 5, 5, restSeconds, incrementKg),
  loadingScheme: "531",
});

export const PROGRAMS: Program[] = [
  {
    id: "tam-vucut-baslangic",
    level: "Başlangıç",
    name: "Tam vücut başlangıç",
    description: "Salonda haftada 3 gün, iki antrenman dönüşümlü. Her harekette tekrar aralığının üstüne ulaşınca ağırlık artar.",
    place: "Salon",
    daysPerWeek: 3,
    templates: [
      {
        name: "Tam Vücut A",
        type: "strength",
        dayOfWeek: 1,
        targetDurationMinutes: 50,
        notes: "Başlangıç programı · A günü",
        exercises: [ex("Goblet Squat", 3, 8, 12), ex("Dumbbell Press", 3, 8, 12), ex("Lat Pulldown", 3, 10, 12), ex("Plank", 3, 20, 40, 60, 0)],
      },
      {
        name: "Tam Vücut B",
        type: "strength",
        dayOfWeek: 3,
        targetDurationMinutes: 50,
        notes: "Başlangıç programı · B günü",
        exercises: [ex("Leg Press", 3, 10, 12, 120, 5), ex("Seated Cable Row", 3, 10, 12), ex("Dumbbell Shoulder Press", 3, 8, 12), ex("Glute Bridge", 3, 12, 15, 60, 0)],
      },
      {
        name: "Tam Vücut A",
        type: "strength",
        dayOfWeek: 5,
        targetDurationMinutes: 50,
        notes: "Başlangıç programı · A günü",
        exercises: [ex("Goblet Squat", 3, 8, 12), ex("Dumbbell Press", 3, 8, 12), ex("Lat Pulldown", 3, 10, 12), ex("Plank", 3, 20, 40, 60, 0)],
      },
    ],
  },
  {
    id: "ev-vucut-agirligi",
    level: "Başlangıç",
    name: "Evde vücut ağırlığı",
    description: "Ekipmansız, haftada 3 gün. Üst sınıra ulaşınca tekrar eklemeye devam et ya da hareketin zor sürümüne geç.",
    place: "Ev",
    daysPerWeek: 3,
    templates: [1, 3, 5].map((dayOfWeek) => ({
      name: "Ev Tam Vücut",
      type: "strength" as const,
      dayOfWeek,
      targetDurationMinutes: 35,
      notes: "Ekipmansız · ağırlık yerine tekrar artır",
      exercises: [
        ex("Bodyweight Squat", 3, 12, 20, 60, 0),
        ex("Pushup", 3, 6, 15, 60, 0),
        ex("Inverted Row", 3, 8, 12, 60, 0),
        ex("Glute Bridge", 3, 12, 20, 60, 0),
        ex("Plank", 3, 20, 45, 45, 0),
      ],
    })),
  },
  {
    id: "ev-dambil",
    level: "Başlangıç",
    name: "Evde dambılla",
    description: "Bir çift ayarlanabilir dambılla haftada 3 gün, tam vücut.",
    place: "Ev",
    daysPerWeek: 3,
    templates: [1, 3, 5].map((dayOfWeek) => ({
      name: "Dambıl Tam Vücut",
      type: "strength" as const,
      dayOfWeek,
      targetDurationMinutes: 45,
      notes: "Ayarlanabilir dambıl yeterli",
      exercises: [
        ex("Goblet Squat", 3, 8, 12),
        ex("Dumbbell Press", 3, 8, 12),
        ex("Dumbbell Row", 3, 8, 12),
        ex("Single Leg RDL", 3, 8, 10),
        ex("Lateral Raise", 2, 12, 15, 60, 1),
        ex("Bicep Curl", 2, 10, 12, 60, 1),
      ],
    })),
  },
  {
    id: "ust-alt",
    level: "Orta",
    name: "Üst / alt (4 gün)",
    description: "Temel hareketleri öğrenmiş olanlar için haftada 4 gün, üst ve alt gövde dönüşümlü.",
    place: "Salon",
    daysPerWeek: 4,
    templates: [
      {
        name: "Üst Gövde A",
        type: "strength",
        dayOfWeek: 1,
        targetDurationMinutes: 60,
        notes: null,
        exercises: [ex("Bench Press", 4, 6, 8, 150), ex("Barbell Row", 4, 6, 8, 150), ex("Overhead Press", 3, 8, 10, 120), ex("Lat Pulldown", 3, 10, 12), ex("Tricep Pushdown", 2, 10, 15, 60, 1)],
      },
      {
        name: "Alt Gövde A",
        type: "strength",
        dayOfWeek: 2,
        targetDurationMinutes: 60,
        notes: null,
        exercises: [ex("Squat", 4, 6, 8, 180, 5), ex("RDL (Romanian Deadlift)", 3, 8, 10, 150, 5), ex("Leg Curl", 3, 10, 12), ex("Standing Calf Raise", 3, 10, 15, 60)],
      },
      {
        name: "Üst Gövde B",
        type: "strength",
        dayOfWeek: 4,
        targetDurationMinutes: 60,
        notes: null,
        exercises: [ex("Incline Dumbbell Press", 3, 8, 10), ex("Seated Cable Row", 3, 10, 12), ex("Dumbbell Shoulder Press", 3, 8, 12), ex("Face Pull", 3, 12, 15, 60, 1), ex("Bicep Curl", 2, 10, 12, 60, 1)],
      },
      {
        name: "Alt Gövde B",
        type: "strength",
        dayOfWeek: 5,
        targetDurationMinutes: 60,
        notes: null,
        exercises: [ex("Deadlift", 3, 4, 6, 180, 5), ex("Leg Press", 3, 10, 12, 120, 5), ex("Bulgarian Split Squat", 3, 8, 10), ex("Hanging Leg Raise", 3, 8, 12, 60, 0)],
      },
    ],
  },
  {
    id: "yuruyus-tam-vucut",
    level: "Başlangıç",
    name: "Yürüyüş + tam vücut",
    description: "Hareketsiz bir dönemden sonra başlamak için: haftada 2 gün kısa tam vücut, 2 gün tempolu yürüyüş.",
    place: "Ev",
    daysPerWeek: 4,
    templates: [
      {
        name: "Kısa Tam Vücut",
        type: "strength",
        dayOfWeek: 1,
        targetDurationMinutes: 30,
        notes: "Tekniği öğrenmek öncelik",
        exercises: [ex("Bodyweight Squat", 2, 10, 15, 60, 0), ex("Pushup", 2, 5, 12, 60, 0), ex("Glute Bridge", 2, 12, 15, 60, 0), ex("Plank", 2, 15, 30, 45, 0)],
      },
      { name: "Tempolu Yürüyüş", type: "easy_run", dayOfWeek: 3, targetDurationMinutes: 30, notes: "Konuşabileceğin tempoda 30 dakika", exercises: [] },
      {
        name: "Kısa Tam Vücut",
        type: "strength",
        dayOfWeek: 4,
        targetDurationMinutes: 30,
        notes: "Tekniği öğrenmek öncelik",
        exercises: [ex("Bodyweight Squat", 2, 10, 15, 60, 0), ex("Pushup", 2, 5, 12, 60, 0), ex("Glute Bridge", 2, 12, 15, 60, 0), ex("Plank", 2, 15, 30, 45, 0)],
      },
      { name: "Tempolu Yürüyüş", type: "easy_run", dayOfWeek: 6, targetDurationMinutes: 30, notes: "Konuşabileceğin tempoda 30 dakika", exercises: [] },
    ],
  },
  {
    id: "wendler-531",
    name: "5/3/1 (Wendler) · 4 gün",
    level: "İleri",
    description:
      "Deneyimli kaldırıcılar için. Her gün bir ana kaldırış: ağırlıklar antrenman maksimumunun (1RM'in %90'ı) yüzdesidir; son set yapabildiğin kadar (5+, 3+, 1+). 4 haftalık döngü: 5'li, 3'lü, 5/3/1 ve deload. Döngü bitince üst vücutta 2,5 kg, alt vücutta 5 kg artar.",
    place: "Salon",
    daysPerWeek: 4,
    oneRepMaxLifts: ["Overhead Press", "Deadlift", "Bench Press", "Squat"],
    templates: [
      {
        name: "5/3/1 · Overhead Press",
        type: "strength",
        dayOfWeek: 1,
        targetDurationMinutes: 60,
        notes: null,
        exercises: [main531("Overhead Press", 2.5), ex("Chin-up", 5, 6, 10, 90, 0), ex("Dips", 3, 8, 12, 90, 0), ex("Face Pull", 3, 12, 15, 60, 1)],
      },
      {
        name: "5/3/1 · Deadlift",
        type: "strength",
        dayOfWeek: 2,
        targetDurationMinutes: 60,
        notes: null,
        exercises: [main531("Deadlift", 5, 240), ex("Leg Curl", 3, 10, 12), ex("Back Extension", 3, 10, 15, 60, 0), ex("Hanging Leg Raise", 3, 8, 12, 60, 0)],
      },
      {
        name: "5/3/1 · Bench Press",
        type: "strength",
        dayOfWeek: 4,
        targetDurationMinutes: 60,
        notes: null,
        exercises: [main531("Bench Press", 2.5), ex("Barbell Row", 5, 8, 10, 90), ex("Incline Dumbbell Press", 3, 8, 12), ex("Tricep Pushdown", 3, 10, 15, 60, 1)],
      },
      {
        name: "5/3/1 · Squat",
        type: "strength",
        dayOfWeek: 5,
        targetDurationMinutes: 60,
        notes: null,
        exercises: [main531("Squat", 5, 240), ex("Leg Press", 3, 10, 12, 120, 5), ex("Lunge", 3, 8, 12, 90), ex("Standing Calf Raise", 3, 10, 15, 60)],
      },
    ],
  },
];

export function findProgram(id: string): Program | undefined {
  return PROGRAMS.find((p) => p.id === id);
}
