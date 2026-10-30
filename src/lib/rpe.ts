/** RPE seçenekleri: 6–10 arası yarım puanlı (6'nın altı kayıt için anlamsız sayılır). */
export const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

/** Set RPE'si: 1–10 aralığına sıkıştırılır, yarım puana yuvarlanır; geçersizse null. */
export function toSetRpe(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(10, Math.max(1, Math.round(n * 2) / 2));
}
