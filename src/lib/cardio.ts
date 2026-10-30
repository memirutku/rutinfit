/**
 * F27: Kardiyo kaydı. Kalori, verilmezse MET × kilo × saat ile tahmin edilir
 * (Compendium of Physical Activities değerlerine yakın yuvarlak sayılar).
 */
export const CARDIO_KINDS = {
  run: "Koşu",
  walk: "Yürüyüş",
  cycle: "Bisiklet",
  swim: "Yüzme",
  other: "Diğer",
} as const;
export type CardioKind = keyof typeof CARDIO_KINDS;
export const CARDIO_KIND_KEYS = Object.keys(CARDIO_KINDS) as [CardioKind, ...CardioKind[]];

const FIXED_MET: Record<CardioKind, number> = { run: 9.8, walk: 3.8, cycle: 7.5, swim: 7, other: 5 };

interface CardioAmount {
  kind: string;
  durationMin: number;
  distanceKm: number | null;
}

/** Koşuda hız biliniyorsa MET ≈ km/sa (6–16 arasında sınırlı); diğerlerinde sabit değer. */
function metFor({ kind, durationMin, distanceKm }: CardioAmount): number {
  if (kind === "run" && distanceKm && durationMin > 0) {
    const speed = distanceKm / (durationMin / 60);
    return Math.min(16, Math.max(6, speed));
  }
  return FIXED_MET[kind as CardioKind] ?? FIXED_MET.other;
}

export function estimateCardioKcal(entry: CardioAmount, weightKg: number): number {
  return Math.round(metFor(entry) * weightKg * (entry.durationMin / 60));
}

/** Tempo: dakika:saniye / km. */
export function formatPace(durationMin: number, distanceKm: number | null | undefined): string | null {
  if (!distanceKm || distanceKm <= 0 || durationMin <= 0) return null;
  const totalSec = Math.round((durationMin / distanceKm) * 60);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")} /km`;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function summarizeCardio(entries: CardioAmount[]) {
  return {
    sessions: entries.length,
    minutes: round1(entries.reduce((a, e) => a + e.durationMin, 0)),
    distanceKm: round1(entries.reduce((a, e) => a + (e.distanceKm ?? 0), 0)),
  };
}
