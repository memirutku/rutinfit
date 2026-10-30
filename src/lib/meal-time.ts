import type { MealType } from "./schemas/enums";

const USUAL_TIME: Partial<Record<MealType, string>> = { breakfast: "08:00", lunch: "12:30", workSnack: "16:00", dinner: "19:00" };

/**
 * Recheck (Zeynep): planlı öğün günlüğe yazılırken saat, kayıt anı değil öğünün saatidir:
 * planlanan saat, yoksa öğün türünün olağan saati; "ekstra" için şimdiki saat.
 */
export function plannedMealLogTime(mealType: MealType, plannedTime?: string | null, now: Date = new Date()): string {
  if (plannedTime && /^\d{2}:\d{2}$/.test(plannedTime)) return plannedTime;
  return USUAL_TIME[mealType] ?? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** Günün saatine göre öğün (panodaki ritim kartıyla aynı sınırlar). */
export function mealTypeForHour(hour: number): MealType {
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 19) return "workSnack";
  if (hour < 22) return "dinner";
  return "extra";
}

/** Öğün sınırları (dakika): 11:00, 16:00, 19:00, 22:00. */
const BOUNDARIES = [11 * 60, 16 * 60, 19 * 60, 22 * 60];
/** Sınıra bu kadar dakikadan yakınsa öğün sorulur. */
const BOUNDARY_WINDOW_MIN = 30;

/**
 * B13: Hızlı eklemede saatin öğünü. Saat bir öğün sınırına yarım saatten yakınsa iki komşu öğün
 * döner ("Hangi öğün?" diye sorulur), değilse tek öğün. Ramazan modunda öğleden sonra ve akşam
 * iftar (akşam yemeği), gece yarısından öğlene kadar sahur (kahvaltı) sayılır.
 */
export function mealChoicesForTime(now: Date, ramadan = false): MealType[] {
  const hour = now.getHours();
  if (ramadan) return [hour < 11 ? "breakfast" : hour < 16 ? "lunch" : "dinner"];
  const minutes = hour * 60 + now.getMinutes();
  const near = BOUNDARIES.find((b) => Math.abs(minutes - b) <= BOUNDARY_WINDOW_MIN);
  if (near === undefined) return [mealTypeForHour(hour)];
  return [mealTypeForHour((near - 60) / 60), mealTypeForHour(near / 60)];
}
