export interface ImportedSet {
  exerciseName: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe?: number;
  isWarmup?: boolean;
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
}

/**
 * Strong veya Hevy CSV metnini RutinFit antrenman kayıtlarına ayrıştırır.
 */
export function parseWorkoutCsv(csvText: string): WorkoutImportResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      success: false,
      appType: "generic_csv",
      workoutCount: 0,
      totalSetsCount: 0,
      workouts: [],
      errors: ["CSV dosyası boş veya başlık satırı içermiyor."],
    };
  }

  // Başlık satırı tespiti
  const headerLine = lines[0].toLowerCase();
  const isHevy =
    headerLine.includes("exercise title") ||
    headerLine.includes("weight_kg") ||
    headerLine.includes("set index");
  const isStrong =
    headerLine.includes("exercise name") &&
    (headerLine.includes("set order") || headerLine.includes("workout name"));

  const appType = isHevy ? "hevy" : isStrong ? "strong" : "generic_csv";

  // Başlık sütun indekslerini bulma
  const headers = parseCsvLine(lines[0].toLowerCase());
  const dateIdx = headers.findIndex((h) => h.includes("date"));
  const workoutNameIdx = headers.findIndex((h) => h.includes("workout"));
  const exerciseIdx = headers.findIndex(
    (h) => h.includes("exercise") || h.includes("title")
  );
  const setIdx = headers.findIndex(
    (h) => h.includes("set") && (h.includes("order") || h.includes("index"))
  );
  const weightIdx = headers.findIndex((h) => h.includes("weight"));
  const repsIdx = headers.findIndex((h) => h.includes("rep"));
  const rpeIdx = headers.findIndex((h) => h.includes("rpe"));

  if (exerciseIdx === -1 || (weightIdx === -1 && repsIdx === -1)) {
    return {
      success: false,
      appType,
      workoutCount: 0,
      totalSetsCount: 0,
      workouts: [],
      errors: [
        "CSV içinde 'Exercise' ve 'Weight'/'Reps' sütunları bulunamadı.",
      ],
    };
  }

  const workoutsMap = new Map<string, ImportedWorkout>();

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length < 3) continue;

    const rawDate = dateIdx !== -1 ? row[dateIdx] : "";
    const parsedDate = normalizeDate(rawDate) || new Date().toISOString().split("T")[0];
    const workoutName =
      workoutNameIdx !== -1 && row[workoutNameIdx]
        ? row[workoutNameIdx]
        : "İçe Aktarılan Antrenman";
    const exerciseName = row[exerciseIdx] || "Egzersiz";
    const weightKg = weightIdx !== -1 ? parseFloat(row[weightIdx]) || 0 : 0;
    const reps = repsIdx !== -1 ? parseInt(row[repsIdx]) || 0 : 0;
    const rpe = rpeIdx !== -1 ? parseFloat(row[rpeIdx]) || undefined : undefined;
    const setNumber =
      setIdx !== -1 ? parseInt(row[setIdx]) || 1 : 1;

    const workoutKey = `${parsedDate}_${workoutName}`;

    if (!workoutsMap.has(workoutKey)) {
      workoutsMap.set(workoutKey, {
        date: parsedDate,
        name: workoutName,
        durationMinutes: 45,
        notes: `${appType.toUpperCase()} uygulamasından içe aktarıldı.`,
        sets: [],
      });
    }

    const currentWorkout = workoutsMap.get(workoutKey)!;
    currentWorkout.sets.push({
      exerciseName,
      setNumber: setNumber || currentWorkout.sets.length + 1,
      weightKg,
      reps,
      rpe,
    });
  }

  const workouts = Array.from(workoutsMap.values());
  const totalSetsCount = workouts.reduce((acc, w) => acc + w.sets.length, 0);

  return {
    success: workouts.length > 0,
    appType,
    workoutCount: workouts.length,
    totalSetsCount,
    workouts,
  };
}

/**
 * CSV satırını virgül ve tırnak işaretlerine duyarlı biçimde böler.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Çeşitli tarih formatlarını YYYY-MM-DD formatına çevirir.
 */
function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.substring(0, 10);
  }
  // DD.MM.YYYY veya DD/MM/YYYY
  const parts = raw.split(/[\.\/\-]/);
  if (parts.length >= 3) {
    if (parts[2].length === 4) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
  }
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }
  return null;
}
