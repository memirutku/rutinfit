/** Hızlı ekleme için "son kullanılan besinler" listesi (localStorage'da tutulur). */
export interface RecentFood {
  id: string;
  name: string;
  defaultGrams: number;
}

export const RECENT_FOODS_KEY = "rutinfit_recent_foods";
export const MAX_RECENT_FOODS = 5;

/** Besini listenin başına alır, tekrarını kaldırır ve listeyi en fazla `max` öğede tutar. */
export function pushRecentFood(
  list: RecentFood[],
  food: RecentFood,
  max = MAX_RECENT_FOODS
): RecentFood[] {
  return [food, ...list.filter((r) => r.id !== food.id)].slice(0, max);
}

/** localStorage'dan okunan ham değeri güvenle ayrıştırır; bozuk veri boş liste döner. */
export function parseRecentFoods(raw: string | null, max = MAX_RECENT_FOODS): RecentFood[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r): r is RecentFood =>
          !!r &&
          typeof r === "object" &&
          typeof (r as RecentFood).id === "string" &&
          typeof (r as RecentFood).name === "string" &&
          typeof (r as RecentFood).defaultGrams === "number" &&
          (r as RecentFood).defaultGrams > 0
      )
      .slice(0, max);
  } catch {
    return [];
  }
}
