/**
 * F28: Metinden antrenman. Kurallı ayrıştırıcıdır (model gerekmez):
 *   "squat 3x8 80 kg" · "bench press 3 x 5 @ 62,5kg" · "deadlift 140kg 2x5 rpe 8"
 *   "barbell row 3x8x60" · "squat 100x5, 100x5, 105x3" · "şınav 3x15" · "lat pulldown 3x10-12 50"
 * Satır ve ";" yeni egzersiz başlatır; virgülden sonra adı olmayan parça önceki egzersizi sürdürür.
 * Adlar kütüphanedeki kanonik ada çevrilir.
 */
import { EXERCISE_LIBRARY, type LibraryExercise } from "./exercise-library";
import { foldTr } from "./food-search";
import { parseDecimalTr } from "./format";
import { toSetRpe } from "./rpe";

export interface TextSet {
  exerciseName: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe?: number;
}

export interface TextLine {
  raw: string;
  ok: boolean;
  exerciseName?: string;
  inLibrary?: boolean;
  message?: string;
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const SETS_REPS = new RegExp(String.raw`^(\d+)\s*[x×]\s*(\d+)(?:\s*[-–]\s*\d+)?(?:\s*(?:[x×@])?\s*${NUM}\s*(?:kg)?)?$`, "i");
const WEIGHT_FIRST = new RegExp(String.raw`^${NUM}\s*kg\s+(\d+)\s*[x×]\s*(\d+)$`, "i");
const WEIGHT_REPS = new RegExp(String.raw`^${NUM}\s*(kg)?\s*[x×]\s*(\d+)$`, "i");

const titleCase = (s: string) =>
  s.replace(/\S+/g, (w) => (/^[\x00-\x7F]+$/.test(w) ? w[0].toUpperCase() : w[0].toLocaleUpperCase("tr-TR")) + w.slice(1));

/** Kütüphane eşleşmesi: tam ad / Türkçe ad, Türkçe karakter katlanmış, ya da tek bir önek eşleşmesi. */
function resolveName(raw: string, library: LibraryExercise[]): { name: string; inLibrary: boolean } {
  const q = foldTr(raw);
  const exact = library.find((e) => foldTr(e.name) === q || foldTr(e.nameTr) === q);
  if (exact) return { name: exact.name, inLibrary: true };
  const prefix = library.filter((e) => foldTr(e.name).startsWith(q) || foldTr(e.nameTr).startsWith(q));
  if (prefix.length === 1) return { name: prefix[0].name, inLibrary: true };
  return { name: titleCase(raw.trim()), inLibrary: false };
}

interface Parsed {
  sets: number;
  reps: number;
  weightKg: number;
}

function parseAmounts(text: string): Parsed | null {
  const t = text.trim();
  let m = WEIGHT_FIRST.exec(t);
  if (m) return { weightKg: parseDecimalTr(m[1]) ?? 0, sets: Number(m[2]), reps: Number(m[3]) };
  m = SETS_REPS.exec(t);
  if (m) {
    const first = Number(m[1]);
    // "100x5" gibi tek çarpımda ilk sayı 10'dan büyükse ağırlık × tekrar sayılır.
    if (m[3] === undefined && first > 10) return { weightKg: first, sets: 1, reps: Number(m[2]) };
    return { sets: first, reps: Number(m[2]), weightKg: m[3] ? parseDecimalTr(m[3]) ?? 0 : 0 };
  }
  m = WEIGHT_REPS.exec(t);
  if (m) return { weightKg: parseDecimalTr(m[1]) ?? 0, sets: 1, reps: Number(m[3]) };
  return null;
}

export function parseWorkoutText(text: string, library: LibraryExercise[] = EXERCISE_LIBRARY): { sets: TextSet[]; lines: TextLine[] } {
  const sets: TextSet[] = [];
  const lines: TextLine[] = [];
  const counters = new Map<string, number>();

  for (const line of text.split(/\n|;/)) {
    let current: { name: string; inLibrary: boolean } | null = null;
    // Ondalık virgülü ("62,5") bölmeden parçalara ayır.
    for (const segment of line.split(/,(?!\d)/)) {
      const raw = segment.trim();
      if (!raw) continue;
      let body = raw;
      let rpe: number | undefined;
      const rpeMatch = /\brpe\s*(\d+(?:[.,]5)?)/i.exec(body);
      if (rpeMatch) {
        rpe = toSetRpe(parseDecimalTr(rpeMatch[1])) ?? undefined;
        body = body.replace(rpeMatch[0], " ");
      }
      const firstDigit = body.search(/\d/);
      const namePart = (firstDigit === -1 ? body : body.slice(0, firstDigit)).replace(/[:\-–]+\s*$/, "").trim();
      if (namePart) current = resolveName(namePart, library);
      const amounts = firstDigit === -1 ? null : parseAmounts(body.slice(firstDigit));
      if (!current || !amounts || amounts.sets < 1 || amounts.sets > 20 || amounts.reps < 1) {
        lines.push({ raw, ok: false, message: "Anlaşılamadı. Örnek: squat 3x8 80 kg" });
        continue;
      }
      for (let i = 0; i < amounts.sets; i++) {
        const n = (counters.get(current.name) ?? 0) + 1;
        counters.set(current.name, n);
        sets.push({ exerciseName: current.name, setNumber: n, weightKg: amounts.weightKg, reps: amounts.reps, ...(rpe ? { rpe } : {}) });
      }
      lines.push({ raw, ok: true, exerciseName: current.name, inLibrary: current.inLibrary });
    }
  }
  return { sets, lines };
}
