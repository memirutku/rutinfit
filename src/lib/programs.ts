/**
 * F18: Hazır programlar (daraltılmış kapsam: başlangıç ve ev programları). Egzersiz adları
 * kütüphanedekilerle aynıdır. Plank gibi süreli hareketlerde tekrar = saniye.
 */
import type { TemplateInput } from "./schemas/workout";

export interface Program {
  id: string;
  name: string;
  description: string;
  place: "Salon" | "Ev";
  daysPerWeek: number;
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

export const PROGRAMS: Program[] = [
  {
    id: "tam-vucut-baslangic",
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
];

export function findProgram(id: string): Program | undefined {
  return PROGRAMS.find((p) => p.id === id);
}
