import { clientId } from "@/lib/client/keys";
import type { LastSetsResponse, WorkoutSessionInput } from "@/lib/schemas/workout";
import type { SetType } from "@/lib/set-types";

/** Seansa dönüştürülebilen şablon (gerçek şablon ya da koşu için türetilmiş şablon). */
export interface SessionExercise {
  exerciseName: string;
  repMin: number;
  repMax: number;
  /** B18: şablondaki set sayısı (yoksa 3). */
  targetSets?: number;
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
  /** B17: boş (null) başlar; önceki seans varsa onun ağırlığıyla dolar. */
  weightKg: number | null;
  reps: number;
  targetRepMin: number;
  targetRepMax: number;
  completed?: boolean;
  /** F20: set başına RPE (boş = girilmedi). */
  rpe?: number | null;
  /** F19: set tipi (yoksa normal). */
  setType?: SetType;
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
 * B17: Önceki seanstan gelen ağırlık: aynı numaralı set, yoksa o seansın son seti. Önceki seans
 * yoksa alan boş kalır (sihirli varsayılan yoktur).
 */
function previousWeight(previous: LastSetsResponse | undefined, exerciseName: string, setNumber: number): number | null {
  const sets = previous?.[exerciseName]?.sets;
  if (!Array.isArray(sets) || sets.length === 0) return null;
  return (sets[setNumber - 1] ?? sets[sets.length - 1]).weightKg ?? null;
}

const DEFAULT_SETS = 3;
const SHORTENED_MAX_SETS = 2;

/** B18: şablondaki set sayısı (1–10); eski şablonlarda yoksa 3. */
const setsFor = (ex: SessionExercise) =>
  Number.isInteger(ex.targetSets) && ex.targetSets! > 0 ? Math.min(ex.targetSets!, 10) : DEFAULT_SETS;

/**
 * Şablondan seans formu kurar. B18: her egzersiz şablondaki set sayısıyla açılır. Hafifletilmiş
 * modda ilk 3 egzersiz, en çok 2'şer set, 25 dk ve RPE 5. Ağırlıklar önceki seanstan gelir ya da boştur.
 */
export function buildSessionForm(template: SessionTemplate, shortened: boolean, previous?: LastSetsResponse): SessionForm {
  const exercises = shortened ? template.exercises.slice(0, 3) : template.exercises;
  const setLogs: SessionSet[] = [];
  for (const ex of exercises) {
    const setsPerExercise = shortened ? Math.min(SHORTENED_MAX_SETS, setsFor(ex)) : setsFor(ex);
    for (let s = 1; s <= setsPerExercise; s++) {
      setLogs.push({
        key: newSetKey(),
        exerciseName: ex.exerciseName,
        setNumber: s,
        weightKg: previousWeight(previous, ex.exerciseName, s),
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
    notes: shortened ? "Hazır olma düşük olduğu için kısaltılmış seans uygulandı." : "",
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

/** Egzersizin setlerine 1'den başlayarak yeniden numara verir. */
function renumber(setLogs: SessionSet[], exerciseName: string): SessionSet[] {
  let n = 0;
  return setLogs.map((s) => (s.exerciseName === exerciseName ? (s.setNumber === ++n ? s : { ...s, setNumber: n }) : s));
}

/**
 * B18: Egzersize set ekler. Yeni set egzersizin son setinin hemen ardına girer; ağırlık, tekrar ve
 * hedef aralığı o setten gelir, tip normal ve tamamlanmamıştır. Egzersiz yoksa form aynen döner.
 */
export function addSet(form: SessionForm, exerciseName: string): SessionForm {
  const lastIndex = form.setLogs.findLastIndex((s) => s.exerciseName === exerciseName);
  if (lastIndex === -1) return form;
  const last = form.setLogs[lastIndex];
  const added: SessionSet = {
    key: newSetKey(),
    exerciseName,
    setNumber: last.setNumber + 1,
    weightKg: last.weightKg,
    reps: last.reps,
    targetRepMin: last.targetRepMin,
    targetRepMax: last.targetRepMax,
    completed: false,
    rpe: null,
    setType: "normal",
  };
  const setLogs = [...form.setLogs.slice(0, lastIndex + 1), added, ...form.setLogs.slice(lastIndex + 1)];
  return { ...form, setLogs: renumber(setLogs, exerciseName) };
}

/** B18: Seti siler; o egzersizin kalan setleri yeniden numaralanır. */
export function removeSet(form: SessionForm, key: string): SessionForm {
  const target = form.setLogs.find((s) => s.key === key);
  if (!target) return form;
  return { ...form, setLogs: renumber(form.setLogs.filter((s) => s.key !== key), target.exerciseName) };
}

/** B18: Setleri egzersize göre, ilk görüldükleri sırayla gruplar (seans ekranı için). */
export function exerciseGroups(form: SessionForm): Array<{ exerciseName: string; sets: SessionSet[] }> {
  const groups = new Map<string, SessionSet[]>();
  for (const s of form.setLogs) groups.set(s.exerciseName, [...(groups.get(s.exerciseName) ?? []), s]);
  return [...groups.entries()].map(([exerciseName, sets]) => ({ exerciseName, sets }));
}

/** B17: "Tamamla" ile işaretlenmemiş set sayısı. */
export function incompleteSetCount(form: SessionForm): number {
  return form.setLogs.filter((s) => !s.completed).length;
}

/** B17: Bitirirken "tamamlandı say": bütün setler tamamlanmış işaretlenir. */
export function markAllCompleted(form: SessionForm): SessionForm {
  return { ...form, setLogs: form.setLogs.map((s) => (s.completed ? s : { ...s, completed: true })) };
}

/**
 * API'ye gönderilecek gövde (istemci anahtarları gönderilmez). B17: yalnız tamamlanan setler
 * gider; set numaraları egzersiz içinde 1'den yeniden sıralanır. Boş ağırlık 0 kg'dır
 * (vücut ağırlığı hareketi).
 */
export function toWorkoutPayload(form: SessionForm, date: string): WorkoutSessionInput {
  const counters = new Map<string, number>();
  return {
    date,
    templateId: form.templateId || undefined,
    name: form.name,
    durationMinutes: form.durationMinutes,
    rpe: form.rpe,
    notes: form.notes,
    completed: true,
    setLogs: form.setLogs
      .filter((s) => s.completed)
      .map((s) => {
        const setNumber = (counters.get(s.exerciseName) ?? 0) + 1;
        counters.set(s.exerciseName, setNumber);
        return {
          exerciseName: s.exerciseName,
          setNumber,
          weightKg: s.weightKg ?? 0,
          reps: s.reps,
          targetRepMin: s.targetRepMin,
          targetRepMax: s.targetRepMax,
          completed: true,
          rpe: s.rpe ?? null,
          setType: s.setType ?? "normal",
        };
      }),
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

/** F25: Bir egzersizin bütün setlerini başka bir egzersizle değiştirir (ağırlık ve tekrar korunur). */
export function replaceExercise(form: SessionForm, from: string, to: string): SessionForm {
  return { ...form, setLogs: form.setLogs.map((s) => (s.exerciseName === from ? { ...s, exerciseName: to } : s)) };
}
