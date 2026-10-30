"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { errorMessage } from "@/lib/client/api";
import { useSaveProfile } from "@/lib/client/queries/system";
import { getLocalDateString } from "@/lib/date-utils";
import { ACTIVITY_LEVELS, ACTIVITY_LEVEL_KEYS, GOAL_TYPES, planTargets, type ActivityLevel, type GoalType } from "@/lib/energy";
import { formatDateTr, formatNumberTr } from "@/lib/format";
import { maxWeeklyLossKg } from "@/lib/safety";
import type { Profile } from "@/lib/schemas/profile";

interface SetupWizardProps {
  open: boolean;
  profile: Profile | undefined;
  onClose: () => void;
}

const STEPS = ["Vücut", "Hareket", "Hedef", "Özet"] as const;
const LOSE_RATES = [0.25, 0.5, 0.75, 1];
const GAIN_RATES = [0.25, 0.5];

const LABEL = "block text-xs font-bold text-slate-700 mb-1";
const INPUT =
  "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

interface WizardState {
  sex: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  goalRateKgPerWeek: number;
  targetWeightKg: number | null;
}

function initialState(p: Profile | undefined): WizardState {
  const activity = ACTIVITY_LEVEL_KEYS.includes(p?.activityLevel as ActivityLevel) ? (p?.activityLevel as ActivityLevel) : "light";
  const goal = p?.goalType ?? "lose";
  // Kurulmamış profildeki değerler şema varsayılanlarıdır, kullanıcının değil: alanlar boş başlar.
  const blank = !p || p.isOnboarded === false;
  return {
    sex: p?.sex ?? "male",
    age: blank ? 0 : p.age,
    heightCm: blank ? 0 : p.heightCm,
    weightKg: blank ? 0 : p.currentWeightKg,
    activityLevel: activity,
    goalType: goal,
    goalRateKgPerWeek: p?.goalRateKgPerWeek || 0.5,
    targetWeightKg: p?.targetWeightKg ?? null,
  };
}

function bodyError(s: WizardState): string | null {
  if (!(s.age >= 13 && s.age <= 100)) return "Yaş 13 ile 100 arasında olmalı.";
  if (!(s.heightCm >= 100 && s.heightCm <= 250)) return "Boy 100 ile 250 cm arasında olmalı.";
  if (!(s.weightKg >= 30 && s.weightKg <= 350)) return "Kilo 30 ile 350 kg arasında olmalı.";
  return null;
}

/**
 * F09: Kurulum sihirbazı. Mifflin-St Jeor + aktivite ile günlük harcamayı, seçilen hedef ve
 * hızla kalori ve makro hedeflerini hesaplar. F56 kuralları (taban, %1 hız sınırı) uygulanır.
 */
export function SetupWizard({ open, profile, onClose }: SetupWizardProps) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(() => initialState(profile));
  const [seededFrom, setSeededFrom] = useState(profile);
  if (profile !== seededFrom) {
    setSeededFrom(profile);
    setState(initialState(profile));
  }
  const save = useSaveProfile();
  const set = <K extends keyof WizardState>(key: K, value: WizardState[K]) => setState((s) => ({ ...s, [key]: value }));

  const today = getLocalDateString();
  const plan = planTargets(
    { ...state, targetWeightKg: state.goalType === "maintain" ? null : state.targetWeightKg },
    today
  );
  const error = step === 0 ? bodyError(state) : null;
  const cap = state.goalType === "lose" ? maxWeeklyLossKg(state.weightKg) : 0.5;
  const rates = state.goalType === "gain" ? GAIN_RATES : LOSE_RATES;

  function close() {
    setStep(0);
    onClose();
  }

  function submit() {
    save.mutate(
      {
        heightCm: state.heightCm,
        age: Math.round(state.age),
        sex: state.sex,
        currentWeightKg: state.weightKg,
        calorieTarget: plan.calorieTarget,
        calorieCeiling: plan.calorieCeiling,
        proteinTargetG: plan.proteinTargetG,
        fatTargetG: plan.fatTargetG,
        carbTargetG: plan.carbTargetG,
        wakeTime: profile?.wakeTime ?? "06:00",
        workdayHomeTime: profile?.workdayHomeTime ?? "19:30",
        hideNumbers: profile?.hideNumbers,
        activityLevel: state.activityLevel,
        goalType: state.goalType,
        goalRateKgPerWeek: state.goalType === "maintain" ? 0 : state.goalRateKgPerWeek,
        targetWeightKg: state.goalType === "maintain" ? null : state.targetWeightKg,
        isOnboarded: true,
      },
      { onSuccess: close }
    );
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
              <select id="wiz-sex" value={state.sex} onChange={(e) => set("sex", e.target.value as WizardState["sex"])} className={INPUT}>
                <option value="male">Erkek</option>
                <option value="female">Kadın</option>
              </select>
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
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="wiz-height" className={LABEL}>
                Boy (cm)
              </label>
              <DecimalInput id="wiz-height" value={state.heightCm || null} onValueChange={(v) => set("heightCm", v)} className={INPUT} />
            </div>
            <div>
              <label htmlFor="wiz-weight" className={LABEL}>
                Kilo (kg)
              </label>
              <DecimalInput id="wiz-weight" value={state.weightKg || null} onValueChange={(v) => set("weightKg", v)} className={INPUT} />
            </div>
            {error && (
              <p role="alert" className="col-span-2 text-xs font-semibold text-rose-700">
                {error}
              </p>
            )}
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

        {step === 3 && (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <dt className="text-slate-500">Bazal metabolizma</dt>
              <dd className="font-bold text-slate-900">{formatNumberTr(plan.bmr)} kcal</dd>
              <dt className="text-slate-500">Günlük harcama (TDEE)</dt>
              <dd className="font-bold text-slate-900">{formatNumberTr(plan.tdee)} kcal</dd>
              <dt className="text-slate-500">Günlük kalori hedefi</dt>
              <dd className="font-bold text-brand-700">
                {formatNumberTr(plan.calorieTarget)} kcal (tavan {formatNumberTr(plan.calorieCeiling)})
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
            {save.isError && (
              <p role="alert" className="text-xs font-semibold text-rose-700">
                {errorMessage(save.error, "Hedefler kaydedilemedi.")}
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
              <button
                type="button"
                disabled={!!error}
                onClick={() => setStep((s) => s + 1)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-40"
              >
                İleri
              </button>
            ) : (
              <button
                type="button"
                disabled={save.isPending}
                onClick={submit}
                className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold disabled:opacity-50"
              >
                {save.isPending ? "Kaydediliyor..." : "Kaydet ve başla"}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
