import { getLocalDateString } from "./date-utils";
import { normalizeSetType, type SetType } from "./set-types";

export interface ImportedSet {
  exerciseName: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe?: number;
  /** F19: normal, warmup, drop, failure */
  setType: SetType;
}

export interface ImportedWorkout {
  date: string; // YYYY-MM-DD
  name: string;
  durationMinutes: number;
  notes?: string;
  sets: ImportedSet[];
}

export interface WorkoutImportResult {
  success: boolean;
  appType: "strong" | "hevy" | "generic_csv";
  workoutCount: number;
  totalSetsCount: number;
  workouts: ImportedWorkout[];
  errors?: string[];
  skippedRows?: number;
  /** H1: kullanıcıya gösterilecek uyarılar (örn. ağırlık sütunu yok). */
  warnings: string[];
  /** H2: dolu olduğu hâlde aktarılamayan sütunların özgün başlıkları. */
  ignoredColumns: string[];
  /** Eski sürümlerle uyum için; F19'dan beri ısınma setleri tipiyle aktarılır (her zaman 0). */
  skippedWarmupSets: number;
}

const LB_TO_KG = 0.45359237;

/**
 * RFC 4180 CSV ayrıştırıcı: "" kaçışı, tırnaklı alanda virgül/satır sonu desteklenir.
 * Kesme işareti (') tırnak sayılmaz ("Farmer's Walk").
 */
export function parseCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim());
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field.trim());
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

function detectDelimiter(firstLine: string): string {
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

const cleanHeader = (h: string) => h.replace(/^\uFEFF/, "").trim();

/** "Weight (kg)" → "weight_kg", "Exercise Name" → "exercise_name". */
const normalizeHeader = (h: string) =>
  cleanHeader(h)
    .toLowerCase()
    .replace(/\s*\(([^)]*)\)/g, "_$1")
    .replace(/[\s-]+/g, "_");

function findColumn(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.indexOf(c);
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Negatif olmayan kg; lbs'den çevrilen değer 0,1 kg'a yuvarlanır. */
function toKg(value: number, factor: number): number {
  const kg = Math.max(0, value) * factor;
  return factor === 1 ? kg : Math.round(kg * 10) / 10;
}

/** "62,5" ve "62.5" ikisini de okur. */
function parseDecimal(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  oca: 1, şub: 2, sub: 2, nis: 4, haz: 6, tem: 7, ağu: 8, agu: 8, eyl: 9, eki: 10, kas: 11, ara: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Tarih biçimleri: 2026-10-16[ 18:30], 16.10.2026, 16/10/2026, "16 Oct 2026, 18:30" (Hevy).
 * GG/AA ile AA/GG belirsizse gün > 12 olan taraf gün sayılır; aksi halde Türkçe GG/AA kabul edilir.
 */
export function normalizeDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const named = value.match(/^(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]{3,})\.?\s+(\d{4})/);
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLocaleLowerCase("tr-TR")];
    if (month) return `${named[3]}-${pad(month)}-${pad(Number(named[1]))}`;
  }

  const numeric = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (numeric) {
    let day = Number(numeric[1]);
    let month = Number(numeric[2]);
    if (month > 12 && day <= 12) [day, month] = [month, day];
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return `${numeric[3]}-${pad(month)}-${pad(day)}`;
  }
  return null;
}

/** "42m", "1h 5m", "1:05:00" → dakika. */
function parseDurationMinutes(raw: string | undefined): number | null {
  if (!raw) return null;
  const h = raw.match(/(\d+)\s*h/);
  const m = raw.match(/(\d+)\s*m(?!s)/);
  if (h || m) return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
  const clock = raw.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (clock) return clock[3] !== undefined ? Number(clock[1]) * 60 + Number(clock[2]) : Number(clock[1]);
  return null;
}

/** Hevy "16 Oct 2026, 18:30" iki zaman arasındaki dakika farkı. */
function minutesBetween(start: string | undefined, end: string | undefined): number | null {
  const time = (v: string | undefined) => v?.match(/(\d{1,2}):(\d{2})/);
  const s = time(start);
  const e = time(end);
  const sd = start ? normalizeDate(start) : null;
  const ed = end ? normalizeDate(end) : null;
  if (!s || !e || !sd || !ed) return null;
  const toMin = (d: string, t: RegExpMatchArray) => Date.parse(`${d}T00:00:00Z`) / 60000 + Number(t[1]) * 60 + Number(t[2]);
  const diff = toMin(ed, e) - toMin(sd, s);
  return diff > 0 && diff < 24 * 60 ? diff : null;
}

/**
 * Strong veya Hevy CSV metnini RutinFit antrenman kayıtlarına ayrıştırır.
 */
export function parseWorkoutCsv(csvText: string): WorkoutImportResult {
  const firstLine = csvText.split(/\r?\n/, 1)[0] ?? "";
  const rows = parseCsv(csvText, detectDelimiter(firstLine));

  if (rows.length < 2) {
    return {
      success: false,
      appType: "generic_csv",
      workoutCount: 0,
      totalSetsCount: 0,
      workouts: [],
      errors: ["CSV dosyası boş veya başlık satırı içermiyor."],
      warnings: [],
      ignoredColumns: [],
      skippedWarmupSets: 0,
    };
  }

  const headers = rows[0].map(normalizeHeader);
  const col = {
    date: findColumn(headers, ["date", "start_time", "tarih"]),
    end: findColumn(headers, ["end_time"]),
    workout: findColumn(headers, ["workout_name", "title", "workout", "antrenman"]),
    exercise: findColumn(headers, ["exercise_name", "exercise_title", "exercise", "egzersiz"]),
    set: findColumn(headers, ["set_order", "set_index", "set", "set_no"]),
    setType: findColumn(headers, ["set_type"]),
    weight: findColumn(headers, ["weight_kg", "weight", "ağırlık", "agirlik", "kg"]),
    weightLbs: findColumn(headers, ["weight_lbs", "weight_lb", "lbs", "lb"]),
    reps: findColumn(headers, ["reps", "tekrar"]),
    rpe: findColumn(headers, ["rpe"]),
    duration: findColumn(headers, ["duration", "süre", "sure"]),
    workoutNotes: findColumn(headers, ["description", "workout_notes"]),
    exerciseNotes: findColumn(headers, ["exercise_notes", "notes", "not"]),
  };
  // kg sütunu yoksa lbs sütunu kullanılır ve kg'a çevrilir.
  const weightCol = col.weight !== -1 ? col.weight : col.weightLbs;
  const weightFactor = col.weight === -1 && col.weightLbs !== -1 ? LB_TO_KG : 1;

  const appType: WorkoutImportResult["appType"] = headers.includes("exercise_title")
    ? "hevy"
    : headers.includes("exercise_name") && (headers.includes("set_order") || headers.includes("workout_name"))
      ? "strong"
      : "generic_csv";

  if (col.exercise === -1 || (weightCol === -1 && col.reps === -1)) {
    return {
      success: false,
      appType,
      workoutCount: 0,
      totalSetsCount: 0,
      workouts: [],
      errors: ["CSV içinde 'Exercise' ve 'Weight'/'Reps' sütunları bulunamadı."],
      warnings: [],
      ignoredColumns: [],
      skippedWarmupSets: 0,
    };
  }

  const zeroBasedSets = headers[col.set] === "set_index";
  const workoutsMap = new Map<string, ImportedWorkout>();
  const setCounters = new Map<string, number>();
  const noteLines = new Map<string, Set<string>>();
  let skippedRows = 0;
  const skippedWarmupSets = 0;
  const cell = (row: string[], idx: number) => (idx !== -1 ? (row[idx] ?? "").trim() : "");

  for (const row of rows.slice(1)) {
    const exerciseName = row[col.exercise];
    if (!exerciseName) {
      skippedRows++;
      continue;
    }
    const setType = normalizeSetType(col.setType !== -1 ? row[col.setType] : "");

    const rawDate = col.date !== -1 ? row[col.date] ?? "" : "";
    const date = normalizeDate(rawDate) ?? getLocalDateString();
    const name = (col.workout !== -1 && row[col.workout]) || "İçe Aktarılan Antrenman";
    const key = `${date}\u0000${name}`;

    if (!workoutsMap.has(key)) {
      const duration =
        parseDurationMinutes(col.duration !== -1 ? row[col.duration] : undefined) ??
        minutesBetween(rawDate, col.end !== -1 ? row[col.end] : undefined) ??
        45;
      workoutsMap.set(key, {
        date,
        name,
        durationMinutes: duration,
        notes: `${appType.toUpperCase()} uygulamasından içe aktarıldı.`,
        sets: [],
      });
    }
    const workout = workoutsMap.get(key)!;

    // H2: seans ve egzersiz notları tekrarsız biriktirilir.
    const lines = noteLines.get(key) ?? new Set<string>();
    noteLines.set(key, lines);
    const workoutNote = cell(row, col.workoutNotes);
    if (workoutNote) lines.add(workoutNote);
    const exerciseNote = cell(row, col.exerciseNotes);
    if (exerciseNote) lines.add(`${exerciseName}: ${exerciseNote}`);

    // Egzersiz başına sayaç (set_index 0'dan başlayan dosyalar için).
    const counterKey = `${key}\u0000${exerciseName}`;
    const parsedSet = col.set !== -1 ? parseInt(row[col.set] ?? "", 10) : NaN;
    const nextCount = (setCounters.get(counterKey) ?? 0) + 1;
    setCounters.set(counterKey, nextCount);
    const setNumber = Number.isFinite(parsedSet) && !zeroBasedSets && parsedSet > 0 ? parsedSet : nextCount;

    const rpe = col.rpe !== -1 ? parseDecimal(row[col.rpe]) : 0;
    workout.sets.push({
      exerciseName,
      setNumber,
      weightKg: weightCol !== -1 ? toKg(parseDecimal(row[weightCol]), weightFactor) : 0,
      reps: col.reps !== -1 ? Math.max(0, Math.round(parseDecimal(row[col.reps]))) : 0,
      rpe: rpe > 0 ? rpe : undefined,
      setType,
    });
  }

  for (const [key, w] of workoutsMap) {
    const lines = noteLines.get(key);
    if (lines?.size) w.notes = [w.notes, ...lines].join("\n");
  }

  // H2: dolu olduğu hâlde hiçbir alana yazılmayan sütunlar.
  const used = new Set<number>(Object.values(col).filter((i) => i !== -1));
  const ignoredColumns = rows[0]
    .map((h, idx) => ({ h: cleanHeader(h), idx }))
    .filter(({ idx }) => !used.has(idx) && rows.slice(1).some((r) => (r[idx] ?? "").trim() !== ""))
    .map(({ h }) => h);
  const warnings = weightCol === -1 ? ["Ağırlık sütunu bulunamadı; setler 0 kg olarak aktarılır."] : [];

  const workouts = Array.from(workoutsMap.values()).filter((w) => w.sets.length > 0);
  const totalSetsCount = workouts.reduce((acc, w) => acc + w.sets.length, 0);

  return {
    success: workouts.length > 0,
    appType,
    workoutCount: workouts.length,
    totalSetsCount,
    workouts,
    skippedRows,
    errors: workouts.length > 0 ? undefined : ["CSV içinde aktarılabilir set bulunamadı."],
    warnings,
    ignoredColumns,
    skippedWarmupSets,
  };
}
