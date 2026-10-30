/**
 * TanStack Query anahtarları. Önek anahtarlar (ör. `foodLogs.all`) geçersiz kılmada
 * o kaynağın tüm varyantlarını (her tarih, her limit) birlikte hedefler.
 */
export const queryKeys = {
  profile: ["profile"] as const,
  aiSettings: ["ai-settings"] as const,
  aiExposure: ["ai-exposure"] as const,
  progress: ["progress"] as const,
  supplements: ["supplements"] as const,
  reminders: ["reminders"] as const,
  fasting: ["fasting"] as const,
  foodLogs: {
    all: ["food-logs"] as const,
    byDate: (date: string) => ["food-logs", date] as const,
  },
  foods: {
    all: ["foods"] as const,
    list: (limit: number, sort?: "usage") => ["foods", { limit, sort }] as const,
  },
  recipes: ["recipes"] as const,
  /** B01: katalog kurulumu (Türk paketi ve başlangıç kataloğu aynı önekte). */
  catalog: {
    all: ["catalog"] as const,
    starter: ["catalog", "starter"] as const,
    turkish: ["catalog", "turkish"] as const,
  },
  mealPlans: {
    all: ["meal-plans"] as const,
    byDate: (date: string) => ["meal-plans", date] as const,
    adherence: (from: string, to: string) => ["meal-plans", "adherence", from, to] as const,
  },
  shopping: {
    all: ["shopping"] as const,
    week: (weekStart: string) => ["shopping", weekStart] as const,
  },
  pantry: ["pantry"] as const,
  savedMeals: ["saved-meals"] as const,
  autoBackup: ["auto-backup"] as const,
  exercises: {
    all: ["exercises"] as const,
    list: (params: string) => ["exercises", "list", params] as const,
    alternatives: (name: string) => ["exercises", "alternatives", name] as const,
  },
  drinks: {
    all: ["drinks"] as const,
    byDate: (date: string) => ["drinks", date] as const,
  },
  workouts: {
    all: ["workouts"] as const,
    list: (date?: string) => ["workouts", date ?? "recent"] as const,
    /** F23/F24: antrenman kaydı değişince birlikte tazelenir (aynı önek). */
    strengthList: ["workouts", "strength", "list"] as const,
    strengthDetail: (exercise: string) => ["workouts", "strength", "detail", exercise] as const,
    volume: (weeks: number) => ["workouts", "volume", weeks] as const,
  },
  conversations: {
    all: ["conversations"] as const,
    detail: (id: string) => ["conversations", id] as const,
  },
  diagnostics: ["diagnostics"] as const,
  openGymStatus: ["opengym-status"] as const,
};

export const mutationKeys = {
  pantryAdjust: ["pantry-adjust"] as const,
};
