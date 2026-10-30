/**
 * TanStack Query anahtarları. Önek anahtarlar (ör. `foodLogs.all`) geçersiz kılmada
 * o kaynağın tüm varyantlarını (her tarih, her limit) birlikte hedefler.
 */
export const queryKeys = {
  profile: ["profile"] as const,
  aiSettings: ["ai-settings"] as const,
  progress: ["progress"] as const,
  foodLogs: {
    all: ["food-logs"] as const,
    byDate: (date: string) => ["food-logs", date] as const,
  },
  foods: {
    all: ["foods"] as const,
    list: (limit: number) => ["foods", { limit }] as const,
  },
  recipes: ["recipes"] as const,
  mealPlans: {
    all: ["meal-plans"] as const,
    byDate: (date: string) => ["meal-plans", date] as const,
  },
  shopping: {
    all: ["shopping"] as const,
    week: (weekStart: string) => ["shopping", weekStart] as const,
  },
  pantry: ["pantry"] as const,
  workouts: {
    all: ["workouts"] as const,
    list: (date?: string) => ["workouts", date ?? "recent"] as const,
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
