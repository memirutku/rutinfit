/**
 * F51: Hazır olma skoru (giyilebilir cihaz gerektirmez). Günlük durum girdilerinden 0–100 puan:
 * uyku %30, enerji %25, kas ağrısı %20, stres %15, ruh hâli %10. Girilmeyen alan ağırlıktan düşer.
 * Bant: <45 düşük, 45–69 orta, ≥70 yüksek. Tıbbi bir ölçüm değildir.
 * En az iki girdi gerekir: tek bir değerden (ör. yalnız uyku) skor ve bant çıkarılmaz.
 */
import { formatNumberTr } from "./format";

export interface ReadinessInput {
  sleepMinutes?: number | null;
  energy1to5?: number | null;
  stress1to5?: number | null;
  soreness1to5?: number | null;
  mood1to5?: number | null;
}

export type ReadinessBand = "low" | "medium" | "high";

export const READINESS_BAND_LABELS: Record<ReadinessBand, string> = { low: "Düşük", medium: "Orta", high: "Yüksek" };

export interface Readiness {
  score: number;
  band: ReadinessBand;
  contributions: Array<{ key: string; label: string; score: number; weight: number }>;
  /** Puanı en çok düşüren girdiler ("Uyku 5 sa", "Kas ağrısı 4/5"). */
  drags: string[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const up = (v: number) => clamp(((v - 1) / 4) * 100); // 1 kötü, 5 iyi
const down = (v: number) => clamp(((5 - v) / 4) * 100); // 1 iyi, 5 kötü

export function computeReadiness(input: ReadinessInput): Readiness | null {
  const parts: Array<{ key: string; label: string; score: number; weight: number }> = [];
  if (input.sleepMinutes != null) {
    const h = input.sleepMinutes / 60;
    parts.push({ key: "sleep", label: `Uyku ${formatNumberTr(Math.round(h * 10) / 10)} sa`, score: clamp(((h - 4) / 4) * 80 + 20), weight: 0.3 });
  }
  if (input.energy1to5 != null) parts.push({ key: "energy", label: `Enerji ${input.energy1to5}/5`, score: up(input.energy1to5), weight: 0.25 });
  if (input.soreness1to5 != null) parts.push({ key: "soreness", label: `Kas ağrısı ${input.soreness1to5}/5`, score: down(input.soreness1to5), weight: 0.2 });
  if (input.stress1to5 != null) parts.push({ key: "stress", label: `Stres ${input.stress1to5}/5`, score: down(input.stress1to5), weight: 0.15 });
  if (input.mood1to5 != null) parts.push({ key: "mood", label: `Ruh hâli ${input.mood1to5}/5`, score: up(input.mood1to5), weight: 0.1 });
  if (parts.length < 2) return null;

  const totalWeight = parts.reduce((a, p) => a + p.weight, 0);
  const score = Math.round(parts.reduce((a, p) => a + p.score * p.weight, 0) / totalWeight);
  const band: ReadinessBand = score < 45 ? "low" : score < 70 ? "medium" : "high";
  const drags = parts
    .filter((p) => p.score < 50)
    .sort((a, b) => (100 - b.score) * b.weight - (100 - a.score) * a.weight)
    .map((p) => p.label);
  return { score, band, contributions: parts, drags };
}
