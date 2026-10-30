"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { errorMessage } from "@/lib/client/api";
import { useSaveProfile } from "@/lib/client/queries/system";
import { useSaveFastingSettings } from "@/lib/client/queries/fasting";
import { useApplyProgram, usePrograms } from "@/lib/client/queries/workouts";
import { PROVINCES } from "@/lib/prayer-times";
import { getLocalDateString } from "@/lib/date-utils";
import { ACTIVITY_LEVELS, ACTIVITY_LEVEL_KEYS, GOAL_TYPES, planTargets, type ActivityLevel, type GoalType } from "@/lib/energy";
import { formatDateTr, formatNumberTr } from "@/lib/format";
import { maxWeeklyLossKg } from "@/lib/safety";
import { DAY_PATTERNS, DAY_PATTERN_LABELS, type DayPattern, type Profile } from "@/lib/schemas/profile";

interface SetupWizardProps {
  open: boolean;
  profile: Profile | undefined;
  onClose: () => void;
}

const STEPS = ["Vücut", "Hareket", "Hedef", "Başlarken", "Özet"] as const;
const START_STEP = 3;
const LOSE_RATES = [0.25, 0.5, 0.75, 1];
const GAIN_RATES = [0.25, 0.5];

const LABEL = "block text-xs font-bold text-slate-700 mb-1";
const INPUT =
  "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

interface WizardState {
  /** B05: boş başlar; kullanıcı seçer. */
  sex: "" | "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  goalRateKgPerWeek: number;
  targetWeightKg: number | null;
  /** B06: başlarken */
  dayPattern: DayPattern | null;
  homeTime: string;
  fasting: boolean;
  province: string;
  programId: string | null;
}

type BodyField = "sex" | "age" | "heightCm" | "weightKg";

function initialState(p: Profile | undefined): WizardState {
  const activity = ACTIVITY_LEVEL_KEYS.includes(p?.activityLevel as ActivityLevel) ? (p?.activityLevel as ActivityLevel) : "light";
  const goal = p?.goalType ?? "lose";
  // Kurulmamış profildeki değerler şema varsayılanlarıdır, kullanıcının değil: alanlar boş başlar.
  const blank = !p || p.isOnboarded === false;
  return {
    sex: blank ? "" : p.sex,
    age: blank ? 0 : p.age,
    heightCm: blank ? 0 : p.heightCm,
    weightKg: blank ? 0 : p.currentWeightKg,
    activityLevel: activity,
    goalType: goal,
    goalRateKgPerWeek: p?.goalRateKgPerWeek || 0.5,
    targetWeightKg: p?.targetWeightKg ?? null,
    dayPattern: p?.dayPattern ?? null,
    homeTime: p?.dayPattern && p.workdayHomeTime ? p.workdayHomeTime : "18:30",
    fasting: p?.ramadanMode ?? false,
    province: p?.ramadanProvince ?? "İstanbul",
    programId: null,
  };
}

function bodyErrors(s: WizardState): Partial<Record<BodyField, string>> {
  const e: Partial<Record<BodyField, string>> = {};
  if (!s.sex) e.sex = "Cinsiyetini seç.";
  if (!(s.age >= 13 && s.age <= 100)) e.age = "Yaş 13 ile 100 arasında olmalı.";
  if (!(s.heightCm >= 100 && s.heightCm <= 250)) e.heightCm = "Boy 100 ile 250 cm arasında olmalı.";
  if (!(s.weightKg >= 30 && s.weightKg <= 350)) e.weightKg = "Kilo 30 ile 350 kg arasında olmalı.";
  return e;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-[11px] font-semibold text-rose-700">
      {message}
    </p>
  );
}

/**
 * F09: Kurulum sihirbazı. Mifflin-St Jeor + aktivite ile günlük harcamayı, seçilen hedef ve
 * hızla kalori ve makro hedeflerini hesaplar. F56 kuralları (taban, %1 hız sınırı) uygulanır.
 */
export function SetupWizard({ open, profile, onClose }: SetupWizardProps) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(() => initialState(profile));
  const [seededFrom, setSeededFrom] = useState(profile);
  // B05: hata yalnız dokunulan alanda ya da "İleri"ye basıldıktan sonra görünür.
  const [touched, setTouched] = useState<Partial<Record<BodyField, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  if (profile !== seededFrom) {
    setSeededFrom(profile);
    setState(initialState(profile));
  }
  const save = useSaveProfile();
  const saveFasting = useSaveFastingSettings();
  const applyProgram = useApplyProgram();
  const programs = usePrograms({ enabled: open && step >= START_STEP });
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const set = <K extends keyof WizardState>(key: K, value: WizardState[K]) => setState((s) => ({ ...s, [key]: value }));
  // Boş alandan çıkmak (ya da "Şimdilik geç"e basmak) hata göstermez; yalnız yazılmış bir değer denetlenir.
  const touch = (field: BodyField) => {
    if (field !== "sex" && state[field]) setTouched((t) => ({ ...t, [field]: true }));
  };

  const today = getLocalDateString();
  const plan = planTargets(
    { ...state, sex: state.sex || "male", targetWeightKg: state.goalType === "maintain" ? null : state.targetWeightKg },
    today
  );
  const errors = step === 0 ? bodyErrors(state) : {};
  const hasErrors = Object.keys(errors).length > 0;
  const shown = (field: BodyField) => (attempted || touched[field] ? errors[field] : undefined);
  const cap = state.goalType === "lose" ? maxWeeklyLossKg(state.weightKg) : 0.5;
  const rates = state.goalType === "gain" ? GAIN_RATES : LOSE_RATES;
  const commute = state.dayPattern === "office" || state.dayPattern === "school";

  function close() {
    setStep(0);
    setTouched({});
    setAttempted(false);
    onClose();
  }

  function goNext() {
    if (hasErrors) {
      setAttempted(true);
      return;
    }
    setAttempted(false);
    setStep((s) => s + 1);
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await save.mutateAsync({
        heightCm: state.heightCm,
        age: Math.round(state.age),
        sex: state.sex || "male",
        currentWeightKg: state.weightKg,
        calorieTarget: plan.calorieTarget,
        calorieCeiling: plan.calorieCeiling,
        proteinTargetG: plan.proteinTargetG,
        fatTargetG: plan.fatTargetG,
        carbTargetG: plan.carbTargetG,
        wakeTime: profile?.wakeTime ?? "07:00",
        workdayHomeTime: commute ? state.homeTime : (profile?.workdayHomeTime ?? state.homeTime),
        hideNumbers: profile?.hideNumbers,
        activityLevel: state.activityLevel,
        goalType: state.goalType,
        goalRateKgPerWeek: state.goalType === "maintain" ? 0 : state.goalRateKgPerWeek,
        targetWeightKg: state.goalType === "maintain" ? null : state.targetWeightKg,
        dayPattern: state.dayPattern,
        isOnboarded: true,
      });
      // B06: oruç ve başlangıç programı yalnız seçildiyse (ya da değiştiyse) kaydedilir.
      const fastingChanged =
        state.fasting !== (profile?.ramadanMode ?? false) || (state.fasting && state.province !== (profile?.ramadanProvince ?? "İstanbul"));
      if (fastingChanged) {
        await saveFasting.mutateAsync(state.fasting ? { ramadanMode: true, ramadanProvince: state.province } : { ramadanMode: false });
      }
      if (state.programId) await applyProgram.mutateAsync({ programId: state.programId, mode: "add" });
      close();
    } catch (e) {
      setSubmitError(e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Hedeflerini birlikte kuralım"
      description={`Adım ${step + 1} / ${STEPS.length}: ${STEPS[step]}`}
      widthClass="max-w-lg"
    >
      <div className="space-y-4">
        {step === 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="wiz-sex" className={LABEL}>
                Cinsiyet
              </label>
              <select
                id="wiz-sex"
                value={state.sex}
                onChange={(e) => set("sex", e.target.value as WizardState["sex"])}
                onBlur={() => touch("sex")}
                aria-invalid={!!shown("sex")}
                aria-describedby={shown("sex") ? "wiz-sex-error" : undefined}
                className={INPUT}
              >
                <option value="" disabled>
                  Seçin
                </option>
                <option value="male">Erkek</option>
                <option value="female">Kadın</option>
              </select>
              <FieldError id="wiz-sex-error" message={shown("sex")} />
            </div>
            <div>
              <label htmlFor="wiz-age" className={LABEL}>
                Yaş
              </label>
              <input
                id="wiz-age"
                type="number"
                value={state.age || ""}
                onChange={(e) => set("age", parseInt(e.target.value, 10) || 0)}
                onBlur={() => touch("age")}
                aria-invalid={!!shown("age")}
                aria-describedby={shown("age") ? "wiz-age-error" : undefined}
                className={INPUT}
              />
              <FieldError id="wiz-age-error" message={shown("age")} />
            </div>
            <div>
              <label htmlFor="wiz-height" className={LABEL}>
                Boy (cm)
              </label>
              <DecimalInput
                id="wiz-height"
                value={state.heightCm || null}
                onValueChange={(v) => set("heightCm", v)}
                onBlur={() => touch("heightCm")}
                aria-invalid={!!shown("heightCm")}
                aria-describedby={shown("heightCm") ? "wiz-height-error" : undefined}
                className={INPUT}
              />
              <FieldError id="wiz-height-error" message={shown("heightCm")} />
            </div>
            <div>
              <label htmlFor="wiz-weight" className={LABEL}>
                Kilo (kg)
              </label>
              <DecimalInput
                id="wiz-weight"
                value={state.weightKg || null}
                onValueChange={(v) => set("weightKg", v)}
                onBlur={() => touch("weightKg")}
                aria-invalid={!!shown("weightKg")}
                aria-describedby={shown("weightKg") ? "wiz-weight-error" : undefined}
                className={INPUT}
              />
              <FieldError id="wiz-weight-error" message={shown("weightKg")} />
            </div>
          </div>
        )}

        {step === 1 && (
          <fieldset className="space-y-2">
            <legend className={LABEL}>Bir haftan genelde nasıl geçiyor?</legend>
            {ACTIVITY_LEVEL_KEYS.map((key) => (
              <label
                key={key}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${
                  state.activityLevel === key ? "border-brand-500 bg-brand-50" : "border-slate-200"
                }`}
              >
                <input
                  type="radio"
                  name="activity"
                  className="mt-1"
                  checked={state.activityLevel === key}
                  onChange={() => set("activityLevel", key)}
                />
                <span>
                  <span className="block text-sm font-bold text-slate-900">{ACTIVITY_LEVELS[key].label}</span>
                  <span className="block text-xs text-slate-500">{ACTIVITY_LEVELS[key].hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <fieldset className="grid grid-cols-3 gap-2">
              <legend className={LABEL}>Hedefin</legend>
              {(Object.keys(GOAL_TYPES) as GoalType[]).map((key) => (
                <label
                  key={key}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-sm font-bold cursor-pointer ${
                    state.goalType === key ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-700"
                  }`}
                >
                  <input type="radio" name="goal" className="sr-only" checked={state.goalType === key} onChange={() => set("goalType", key)} />
                  {GOAL_TYPES[key]}
                </label>
              ))}
            </fieldset>

            {state.goalType !== "maintain" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="wiz-target" className={LABEL}>
                    Hedef kilo (kg)
                  </label>
                  <DecimalInput
                    id="wiz-target"
                    value={state.targetWeightKg}
                    onValueChange={(v) => set("targetWeightKg", v > 0 ? v : null)}
                    placeholder="İsteğe bağlı"
                    className={INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="wiz-rate" className={LABEL}>
                    Haftalık hız
                  </label>
                  <select
                    id="wiz-rate"
                    value={state.goalRateKgPerWeek}
                    onChange={(e) => set("goalRateKgPerWeek", Number(e.target.value))}
                    className={INPUT}
                  >
                    {rates.map((r) => (
                      <option key={r} value={r}>
                        {formatNumberTr(r)} kg / hafta
                      </option>
                    ))}
                  </select>
                </div>
                <p className="col-span-2 text-xs text-slate-500">
                  Güvenli üst sınır: {formatNumberTr(cap)} kg / hafta
                  {state.goalType === "lose" ? " (vücut ağırlığının %1'i)" : ""}.
                </p>
              </div>
            )}
          </div>
        )}

        {step === START_STEP && (
          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className={LABEL}>Günün genelde nasıl geçiyor?</legend>
              <div className="grid grid-cols-2 gap-2">
                {[...DAY_PATTERNS, null].map((key) => (
                  <label
                    key={key ?? "none"}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                      state.dayPattern === key ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-700"
                    }`}
                  >
                    <input type="radio" name="day-pattern" checked={state.dayPattern === key} onChange={() => set("dayPattern", key)} />
                    {key ? DAY_PATTERN_LABELS[key] : "Belirtmek istemiyorum"}
                  </label>
                ))}
              </div>
              {commute && (
                <div className="max-w-[12rem]">
                  <label htmlFor="wiz-home-time" className={LABEL}>
                    Eve varış saati
                  </label>
                  <input
                    id="wiz-home-time"
                    type="time"
                    value={state.homeTime}
                    onChange={(e) => set("homeTime", e.target.value)}
                    className={INPUT}
                  />
                </div>
              )}
              <p className="text-[11px] text-slate-500">Panodaki günlük ritim kartı buna göre öneri verir.</p>
            </fieldset>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <input type="checkbox" checked={state.fasting} onChange={(e) => set("fasting", e.target.checked)} />
                Ramazan&apos;da oruç tutuyorum
              </label>
              {state.fasting && (
                <div className="max-w-[14rem]">
                  <label htmlFor="wiz-province" className={LABEL}>
                    İl
                  </label>
                  <select id="wiz-province" value={state.province} onChange={(e) => set("province", e.target.value)} className={INPUT}>
                    {PROVINCES.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">İmsak ve iftar saatleri internetsiz hesaplanır.</p>
                </div>
              )}
            </div>

            <fieldset className="space-y-2">
              <legend className={LABEL}>Başlangıç antrenman programı</legend>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input type="radio" name="program" checked={state.programId === null} onChange={() => set("programId", null)} />
                Şimdilik program seçme
              </label>
              {programs.data?.map((p) => (
                <label key={p.id} className="flex items-start gap-2 text-xs text-slate-700">
                  <input type="radio" name="program" className="mt-0.5" checked={state.programId === p.id} onChange={() => set("programId", p.id)} />
                  <span>
                    <span className="font-semibold text-slate-900">{p.name}</span> · {p.place}, haftada {p.daysPerWeek} gün
                  </span>
                </label>
              ))}
              {programs.isError && <p className="text-[11px] text-slate-500">Programlar yüklenemedi; Antrenman sayfasından sonra ekleyebilirsin.</p>}
            </fieldset>
          </div>
        )}

        {step === STEPS.length - 1 && (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <dt className="text-slate-500">Bazal metabolizma</dt>
              <dd className="font-bold text-slate-900">{formatNumberTr(plan.bmr)} kcal</dd>
              <dt className="text-slate-500">Günlük harcaman (tahmini)</dt>
              <dd className="font-bold text-slate-900">{formatNumberTr(plan.tdee)} kcal</dd>
              <dt className="text-slate-500">Günlük kalori hedefi</dt>
              <dd className="font-bold text-brand-700">
                {formatNumberTr(plan.calorieTarget)} kcal (en fazla {formatNumberTr(plan.calorieCeiling)})
              </dd>
              <dt className="text-slate-500">Makrolar</dt>
              <dd className="font-semibold text-slate-800">
                Protein {plan.proteinTargetG} g · Yağ {plan.fatTargetG} g · Karbonhidrat {plan.carbTargetG} g
              </dd>
              {plan.etaDate && (
                <>
                  <dt className="text-slate-500">Tahmini varış</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatDateTr(plan.etaDate)} ({plan.weeksToGoal} hafta)
                  </dd>
                </>
              )}
            </dl>
            {plan.notes.length > 0 && (
              <ul className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                {plan.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            <p className="text-xs text-slate-500">
              Bu bir tahmindir. Kilonu düzenli girdikçe hedeflerini gözden geçirebilirsin. Hedefler Ayarlar sayfasından
              istediğin zaman değişir.
            </p>
            {submitError != null && (
              <p role="alert" className="text-xs font-semibold text-rose-700">
                {errorMessage(submitError, "Hedefler kaydedilemedi.")}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button type="button" onClick={close} className="text-xs font-semibold text-slate-500 hover:text-slate-700">
            Şimdilik geç
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
              >
                Geri
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={goNext} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">
                İleri
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={submit}
                className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold disabled:opacity-50"
              >
                {submitting ? "Kaydediliyor..." : "Kaydet ve başla"}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
