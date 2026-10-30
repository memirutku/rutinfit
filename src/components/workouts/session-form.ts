import { clientId } from "@/lib/client/keys";
import type { WorkoutSessionInput } from "@/lib/schemas/workout";

/** Seansa dönüştürülebilen şablon (gerçek şablon ya da koşu için türetilmiş şablon). */
export interface SessionExercise {
  exerciseName: string;
  repMin: number;
  repMax: number;
}

export interface SessionTemplate {
  id: string;
  name: string;
  targetDurationMinutes: number;
  exercises: SessionExercise[];
}

export interface SessionSet {
  /** Satırın kararlı React anahtarı (istemcide üretilir, API'ye gönderilmez). */
  key: string;
  exerciseName: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  targetRepMin: number;
  targetRepMax: number;
  completed?: boolean;
  /** F20: set başına RPE (boş = girilmedi). */
  rpe?: number | null;
}

export interface SessionForm {
  templateId: string;
  name: string;
  durationMinutes: number;
  rpe: number;
  notes: string;
  setLogs: SessionSet[];
}

/** localStorage'daki set/form: eski taslaklarda satır anahtarı yoktur. */
type StoredSet = Omit<SessionSet, "key"> & { key?: string };
type StoredForm = Omit<SessionForm, "setLogs"> & { setLogs?: StoredSet[] };

/** Aktif seans: kaynak şablon + form + hafifletilmiş mod. */
export interface ActiveWorkout {
  template: SessionTemplate;
  form: SessionForm;
  shortened: boolean;
}

/** localStorage taslağının biçimi (eski sürümlerle uyumlu; anahtar adları değişmez). */
export interface WorkoutDraft {
  activeSession: SessionTemplate;
  sessionForm: SessionForm;
  isShortenedMode: boolean;
}

export const WORKOUT_DRAFT_KEY = "rutinfit_active_workout_draft";

const newSetKey = () => clientId("set");

/**
 * Şablondan seans formu kurar. Hafifletilmiş modda ilk 3 egzersiz × 2 set, 25 dk ve
 * RPE 5; normal modda tüm egzersizler × 3 set.
 */
export function buildSessionForm(template: SessionTemplate, shortened: boolean): SessionForm {
  const exercises = shortened ? template.exercises.slice(0, 3) : template.exercises;
  const setsPerExercise = shortened ? 2 : 3;
  const setLogs: SessionSet[] = [];
  for (const ex of exercises) {
    for (let s = 1; s <= setsPerExercise; s++) {
      setLogs.push({
        key: newSetKey(),
        exerciseName: ex.exerciseName,
        setNumber: s,
        weightKg: 40, // başlangıç varsayılanı
        reps: ex.repMax,
        targetRepMin: ex.repMin,
        targetRepMax: ex.repMax,
        completed: false,
      });
    }
  }
  return {
    templateId: template.id,
    name: shortened ? `${template.name} (25 dk Hafifletilmiş)` : template.name,
    durationMinutes: shortened ? 25 : template.targetDurationMinutes,
    rpe: shortened ? 5 : 7,
    notes: shortened ? "İş çıkışı yorgunluk nedeniyle kısaltılmış seans uygulandı." : "",
    setLogs,
  };
}

/** Anahtarı olmayan setlere (eski taslaklar) anahtar atar. */
export function withSetKeys(form: StoredForm): SessionForm {
  const setLogs = Array.isArray(form.setLogs) ? form.setLogs : [];
  return { ...form, setLogs: setLogs.map((s) => ({ ...s, key: s.key || newSetKey() })) };
}

/** Tek bir seti değiştirir; diğer setler ve form nesnesi yerinde değiştirilmez. */
export function updateSet(form: SessionForm, key: string, patch: Partial<SessionSet>): SessionForm {
  return { ...form, setLogs: form.setLogs.map((s) => (s.key === key ? { ...s, ...patch } : s)) };
}

/** API'ye gönderilecek gövde (istemci anahtarları gönderilmez). */
export function toWorkoutPayload(form: SessionForm, date: string): WorkoutSessionInput {
  return {
    date,
    templateId: form.templateId || undefined,
    name: form.name,
    durationMinutes: form.durationMinutes,
    rpe: form.rpe,
    notes: form.notes,
    completed: true,
    setLogs: form.setLogs.map((s) => ({
      exerciseName: s.exerciseName,
      setNumber: s.setNumber,
      weightKg: s.weightKg,
      reps: s.reps,
      targetRepMin: s.targetRepMin,
      targetRepMax: s.targetRepMax,
      isTargetMet: s.completed ?? s.reps >= s.targetRepMin,
      rpe: s.rpe ?? null,
    })),
  };
}

export function toDraft(active: ActiveWorkout): WorkoutDraft {
  return { activeSession: active.template, sessionForm: active.form, isShortenedMode: active.shortened };
}

export function fromDraft(draft: WorkoutDraft): ActiveWorkout {
  return { template: draft.activeSession, form: withSetKeys(draft.sessionForm), shortened: draft.isShortenedMode };
}

/** Kayıtlı taslağı güvenle okur; bozuk veya eksik taslak null döner. */
export function parseWorkoutDraft(raw: string | null): WorkoutDraft | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const draft = parsed as { activeSession?: SessionTemplate; sessionForm?: StoredForm; isShortenedMode?: boolean };
    if (!draft.sessionForm || !draft.activeSession) return null;
    return {
      activeSession: draft.activeSession,
      sessionForm: withSetKeys(draft.sessionForm),
      isShortenedMode: draft.isShortenedMode || false,
    };
  } catch {
    return null;
  }
}
