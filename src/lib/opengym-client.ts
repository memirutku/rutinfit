import fs from "fs";
import { promises as fsp } from "fs";
import path from "path";
import { getStoragePaths } from "./storage-paths";

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

/**
 * OpenGym veri dizinini çevre değişkenine veya OS uygulama depolama dizinine göre çözümler.
 */
export function getOpenGymDataDir(): string {
  if (process.env.OPENGYM_DATA_DIR) {
    return path.resolve(process.env.OPENGYM_DATA_DIR);
  }
  try {
    const appStorageDir = getStoragePaths().dataDir;
    const appDataOpenGym = path.join(appStorageDir, "opengym", "data");
    if (fs.existsSync(appDataOpenGym)) {
      return appDataOpenGym;
    }
  } catch {
    // getStoragePaths hatası durumunda varsayılan yola geçilir
  }
  return path.join(process.cwd(), "opengym", "data");
}

/**
 * openGym HTTP API sağlık durumunu kontrol eder.
 */
export async function checkOpenGymHealth(
  baseUrl = process.env.OPENGYM_BASE_URL || "http://localhost:8080"
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
 * openGym yerel veri klasöründeki kullanıcı durum dosyasını (state-*.json) asenkron okur.
 */
export async function getOpenGymLocalState(): Promise<OpenGymState | null> {
  try {
    const dataDir = getOpenGymDataDir();
    if (!fs.existsSync(dataDir)) {
      return null;
    }

    const files = await fsp.readdir(dataDir);
    const stateFile = files.find(
      (f) => f.startsWith("state-") && f.endsWith(".json")
    );

    if (!stateFile) {
      return null;
    }

    const content = await fsp.readFile(
      path.join(dataDir, stateFile),
      "utf-8"
    );
    return JSON.parse(content) as OpenGymState;
  } catch (err) {
    console.error("openGym local state okuma hatası:", err);
    return null;
  }
}

/**
 * RutinFit tartı kayıtlarını openGym state dosyasına asenkron olarak yazar.
 */
export async function syncWeightsToOpenGymState(
  rfWeights: { date: string; weightKg: number }[]
): Promise<number> {
  try {
    const dataDir = getOpenGymDataDir();
    if (!fs.existsSync(dataDir) || rfWeights.length === 0) {
      return 0;
    }

    const files = await fsp.readdir(dataDir);
    const stateFile = files.find(
      (f) => f.startsWith("state-") && f.endsWith(".json")
    );

    if (!stateFile) {
      return 0;
    }

    const filePath = path.join(dataDir, stateFile);
    const content = await fsp.readFile(filePath, "utf-8");
    const currentState = JSON.parse(content);

    const currentWeights: { date: string; weight: number }[] =
      currentState.bodyWeight || [];
    const dateSet = new Set(currentWeights.map((w) => w.date));

    let addedCount = 0;
    for (const w of rfWeights) {
      if (!dateSet.has(w.date)) {
        currentWeights.push({ date: w.date, weight: w.weightKg });
        addedCount++;
      }
    }

    if (addedCount > 0) {
      currentWeights.sort((a, b) => a.date.localeCompare(b.date));
      currentState.bodyWeight = currentWeights;
      await fsp.writeFile(filePath, JSON.stringify(currentState, null, 2), "utf-8");
    }

    return addedCount;
  } catch (err) {
    console.error("openGym tartı senkronizasyon hatası:", err);
    return 0;
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
