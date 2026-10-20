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
  // turbopackIgnore: kullanıcı verisi klasörü; derleyicinin dosya izleyicisi bu yolları takip edip
  // pakete katmasın (aksi halde dinamik yol yüzünden tüm proje standalone çıktıya girer).
  if (process.env.OPENGYM_DATA_DIR) {
    return path.resolve(/*turbopackIgnore: true*/ process.env.OPENGYM_DATA_DIR);
  }
  try {
    const appStorageDir = getStoragePaths().dataDir;
    const appDataOpenGym = path.join(/*turbopackIgnore: true*/ appStorageDir, "opengym", "data");
    if (fs.existsSync(/*turbopackIgnore: true*/ appDataOpenGym)) {
      return appDataOpenGym;
    }
  } catch {
    // getStoragePaths hatası durumunda varsayılan yola geçilir
  }
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "opengym", "data");
}

/**
 * openGym HTTP API sağlık durumunu kontrol eder.
 */
export async function checkOpenGymHealth(
  baseUrl = process.env.OPENGYM_BASE_URL || "http://localhost:8080",
  timeoutMs = 3000
): Promise<OpenGymHealth> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
  // Yalnız SetLog tablosundaki alanlar üretilir (fazla alan Prisma create'i düşürür).
  const setLogs = (ogWorkout.exercises || []).flatMap((ex) =>
    (ex.sets || [])
      .filter((s) => !s.isWarmup)
      .map((s, idx) => ({
        exerciseName: ex.name || ex.exerciseId || "Egzersiz",
        setNumber: idx + 1,
        weightKg: Math.max(0, Number(s.weight) || 0),
        reps: Math.max(0, Math.round(Number(s.reps) || 0)),
        isTargetMet: (s.reps || 0) >= 10,
      }))
  );

  const rawRpe = Number(ogWorkout.exercises?.[0]?.sets?.[0]?.rpe);
  const rpe = Number.isFinite(rawRpe) && rawRpe > 0 ? Math.min(10, Math.max(1, Math.round(rawRpe))) : 7;

  return {
    date: ogWorkout.date,
    name: ogWorkout.name || "openGym Antrenmanı",
    durationMinutes: ogWorkout.durationSeconds
      ? Math.round(ogWorkout.durationSeconds / 60)
      : 40,
    rpe,
    notes: ogWorkout.notes || "openGym üzerinden kaydedildi",
    completed: true,
    setLogs,
  };
}


/**
 * AI koçunun sistem promptu için openGym özeti. Her sohbet mesajında çağrıldığı için
 * sağlık kontrolü kısa zaman aşımıyla yapılır (openGym kapalıyken yanıtı geciktirmez).
 */
export async function getOpenGymSummary() {
  const [health, state] = await Promise.all([
    checkOpenGymHealth(undefined, 800),
    getOpenGymLocalState(),
  ]);

  return {
    isOnline: health.isOnline,
    serviceUrl: health.url,
    totalWorkouts: state?.workouts?.length ?? 0,
    recentWorkouts: (state?.workouts ?? []).slice(-5).map((w) => ({
      id: w.id,
      date: w.date,
      name: w.name,
      exerciseCount: w.exercises.length,
      totalSets: w.exercises.reduce((acc, ex) => acc + ex.sets.length, 0),
    })),
    recentWeights: (state?.bodyWeight ?? []).slice(-7).map((b) => ({ date: b.date, weightKg: b.weight })),
  };
}
