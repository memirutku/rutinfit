import fs from "fs";
import path from "path";

export interface OpenGymHealth {
  isOnline: boolean;
  url: string;
  version?: string;
  error?: string;
}

export interface OpenGymWorkoutSet {
  weight?: number;
  reps?: number;
  rpe?: number;
  isWarmup?: boolean;
}

export interface OpenGymExerciseEntry {
  exerciseId: string;
  name?: string;
  sets: OpenGymWorkoutSet[];
}

export interface OpenGymWorkout {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  durationSeconds?: number;
  exercises: OpenGymExerciseEntry[];
  notes?: string;
}

export interface OpenGymBodyWeight {
  date: string; // YYYY-MM-DD
  weight: number; // kg
}

export interface OpenGymState {
  workouts?: OpenGymWorkout[];
  bodyWeight?: OpenGymBodyWeight[];
  routines?: any[];
}

const OPENGYM_DATA_DIR = path.join(process.cwd(), "opengym", "data");

/**
 * openGym HTTP API sağlık durumunu kontrol eder.
 */
export async function checkOpenGymHealth(
  baseUrl = "http://localhost:8080"
): Promise<OpenGymHealth> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${baseUrl}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        isOnline: true,
        url: baseUrl,
        version: data.version || "1.4.1",
      };
    }

    return {
      isOnline: false,
      url: baseUrl,
      error: `HTTP ${res.status}: ${res.statusText}`,
    };
  } catch (err: any) {
    return {
      isOnline: false,
      url: baseUrl,
      error: err.message || "Bağlantı kurulamadı",
    };
  }
}

/**
 * openGym yerel veri klasöründeki kullanıcı durum dosyasını (state-*.json) okur.
 */
export function getOpenGymLocalState(): OpenGymState | null {
  try {
    if (!fs.existsSync(OPENGYM_DATA_DIR)) {
      return null;
    }

    const files = fs.readdirSync(OPENGYM_DATA_DIR);
    const stateFile = files.find(
      (f) => f.startsWith("state-") && f.endsWith(".json")
    );

    if (!stateFile) {
      return null;
    }

    const content = fs.readFileSync(
      path.join(OPENGYM_DATA_DIR, stateFile),
      "utf-8"
    );
    return JSON.parse(content) as OpenGymState;
  } catch (err) {
    console.error("openGym local state okuma hatası:", err);
    return null;
  }
}

/**
 * openGym formatındaki antrenmanları RutinFit formatına dönüştürür.
 */
export function mapOpenGymWorkoutToRutinFit(ogWorkout: OpenGymWorkout) {
  const setLogs = (ogWorkout.exercises || []).flatMap((ex) =>
    (ex.sets || []).map((s, idx) => ({
      exerciseName: ex.name || ex.exerciseId || "Egzersiz",
      setNumber: idx + 1,
      weightKg: s.weight || 0,
      reps: s.reps || 0,
      targetRepMin: 8,
      targetRepMax: 12,
      isTargetMet: (s.reps || 0) >= 10,
    }))
  );

  return {
    date: ogWorkout.date,
    name: ogWorkout.name || "openGym Antrenmanı",
    durationMinutes: ogWorkout.durationSeconds
      ? Math.round(ogWorkout.durationSeconds / 60)
      : 40,
    rpe: ogWorkout.exercises?.[0]?.sets?.[0]?.rpe || 7,
    notes: ogWorkout.notes || "openGym üzerinden kaydedildi",
    completed: true,
    setLogs,
  };
}

/**
 * RutinFit kilo kayıtlarını openGym formatına dönüştürür.
 */
export function mapRutinFitWeightsToOpenGym(
  rutinFitWeights: { date: string; weightKg: number }[]
): OpenGymBodyWeight[] {
  return rutinFitWeights.map((w) => ({
    date: w.date,
    weight: w.weightKg,
  }));
}
