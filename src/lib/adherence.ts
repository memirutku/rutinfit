/** F78: Plana uyum. Uygulandı 1, kısmen 0,5, atlandı 0 puan; işaretlenmemiş öğün sayılmaz. */
export const ADHERENCE_VALUES = ["done", "partial", "skipped"] as const;
export type Adherence = (typeof ADHERENCE_VALUES)[number];

export const ADHERENCE_LABELS: Record<Adherence, string> = {
  done: "Uygulandı",
  partial: "Kısmen",
  skipped: "Atlandı",
};

export interface AdherenceSummary {
  planned: number;
  marked: number;
  done: number;
  partial: number;
  skipped: number;
  /** Yüzde (0–100); hiç işaret yoksa null. */
  percent: number | null;
}

export function computeAdherence(meals: Array<{ adherence: string | null }>): AdherenceSummary {
  const count = (v: Adherence) => meals.filter((m) => m.adherence === v).length;
  const done = count("done");
  const partial = count("partial");
  const skipped = count("skipped");
  const marked = done + partial + skipped;
  return {
    planned: meals.length,
    marked,
    done,
    partial,
    skipped,
    percent: marked ? Math.round(((done + partial * 0.5) / marked) * 100) : null,
  };
}
