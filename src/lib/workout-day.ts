/**
 * B20: Haftalık plan ve günün antrenmanı için ortak kurallar: haftanın günü, şablondan gün
 * açıklaması ve "bugün hangi şablon yapıldı" eşleşmesi.
 */
import type { WorkoutSession, WorkoutTemplate } from "./schemas/workout";
import { normalizeName } from "./text";

/** "YYYY-MM-DD" gününün haftadaki yeri: 1 = Pazartesi ... 7 = Pazar (saat diliminden bağımsız). */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

const LISTED = 3;

/**
 * Gün kartı açıklaması. Şablonun notu varsa o; yoksa türüne göre üretilir. Ağırlık günü için
 * hareket ve set sayısı ile ilk hareketler ("5 hareket · 16 set: Bench Press, ..."). Antrenman
 * gününe hiçbir zaman "toparlanma" yazılmaz.
 */
export function describeTemplate(template: Pick<WorkoutTemplate, "type" | "notes" | "exercises" | "targetDurationMinutes"> | undefined): string {
  if (!template || template.type === "rest") return template?.notes?.trim() || "Dinlenme ve toparlanma günü. İsteğe bağlı hafif yürüyüş.";
  if (template.notes?.trim()) return template.notes.trim();
  if (template.type === "easy_run") return `${template.targetDurationMinutes} dk kolay tempo; konuşabileceğin hızda.`;
  const exercises = template.exercises ?? [];
  if (exercises.length === 0) return "Hareket eklenmemiş. Şablonu düzenleyerek hareket ekleyebilirsin.";
  const sets = exercises.reduce((sum, e) => sum + (e.targetSets || 0), 0);
  const names = exercises.slice(0, LISTED).map((e) => e.exerciseName).join(", ");
  const more = exercises.length > LISTED ? ` ve ${exercises.length - LISTED} hareket daha` : "";
  return `${exercises.length} hareket · ${sets} set: ${names}${more}`;
}

/** Seans bu şablondan mı yapıldı? Şablon kimliği yoksa (metinden eklenen) ad eşleşmesi. */
export function sessionMatchesTemplate(session: Pick<WorkoutSession, "templateId" | "name">, template: Pick<WorkoutTemplate, "id" | "name">): boolean {
  if (session.templateId) return session.templateId === template.id;
  return normalizeName(session.name) === normalizeName(template.name);
}

export interface TodayWorkoutStatus {
  /** Bugünün planlı şablonu (birden çoksa yapılmış olan, yoksa ilki). */
  planned?: WorkoutTemplate;
  /** Planlı şablon bugün yapıldı mı? */
  completed: boolean;
  /** Bugün yapılan ama planlı şablona ait olmayan seanslar. */
  doneOther: WorkoutSession[];
}

/** B20: "Tamamlandı" durumu bugün yapılan şablona göre belirlenir (herhangi bir seans yetmez). */
export function todayWorkoutStatus(templates: WorkoutTemplate[], sessions: WorkoutSession[], today: string): TodayWorkoutStatus {
  const weekday = weekdayOf(today);
  const todays = templates.filter((t) => t.dayOfWeek === weekday);
  const doneToday = sessions.filter((s) => s.date === today && s.completed);
  const isDone = (t: WorkoutTemplate) => doneToday.some((s) => sessionMatchesTemplate(s, t));
  const planned = todays.find(isDone) ?? todays[0];
  return {
    planned,
    completed: planned ? isDone(planned) : false,
    doneOther: doneToday.filter((s) => !planned || !sessionMatchesTemplate(s, planned)),
  };
}
