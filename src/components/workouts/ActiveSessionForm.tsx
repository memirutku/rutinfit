"use client";

import { useId, useState, type FormEvent } from "react";
import type { Countdown } from "@/hooks/useCountdown";
import { RestTimer } from "./RestTimer";
import { SetRow } from "./SetRow";
import { ExerciseSwap } from "./ExerciseSwap";
import { incompleteSetCount, markAllCompleted, replaceExercise, updateSet, type SessionForm } from "./session-form";

interface ActiveSessionFormProps {
  form: SessionForm;
  onChange: (form: SessionForm) => void;
  restTimer: Countdown;
  saving: boolean;
  saveError: string | null;
  /** Kaydedilecek form (B17: tamamlanmayan setler için karar verildikten sonra). */
  onFinish: (form: SessionForm) => void;
  /** Üstteki "Vazgeç": seansı kapatır ve taslağı siler. */
  onDiscard: () => void;
  /** Alttaki "İptal Et": seansı kapatır, taslak kayıtlı kalır. */
  onClose: () => void;
}

/** Aktif seans girişi: dinlenme sayacı, set satırları, RPE ve süre. */
export function ActiveSessionForm({
  form,
  onChange,
  restTimer,
  saving,
  saveError,
  onFinish,
  onDiscard,
  onClose,
}: ActiveSessionFormProps) {
  const rpeId = useId();
  const durationId = useId();
  const promptId = useId();
  // B17: tamamlanmamış set varsa bitirmeden önce "at / tamamlandı say" sorulur.
  const [asking, setAsking] = useState(false);
  const incomplete = incompleteSetCount(form);
  const completedCount = form.setLogs.length - incomplete;
  const emptyWeightIncomplete = form.setLogs.some((s) => !s.completed && s.weightKg === null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (incomplete > 0) {
      setAsking(true);
      return;
    }
    onFinish(form);
  }

  function finishWith(next: SessionForm) {
    setAsking(false);
    onFinish(next);
  }

  function toggleSet(key: string, completed: boolean) {
    onChange(updateSet(form, key, { completed: !completed }));
    // Otomatik dinlenme sayacını başlat (son seçilen süreyle)
    if (!completed) restTimer.start(restTimer.totalSeconds || 90);
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-brand-300 shadow-md space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h3 className="text-lg font-bold text-slate-900">{form.name}</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Hedef: {form.durationMinutes} dakika · Her setin ağırlık ve tekrarını kaydedin.
          </p>
        </div>
        <button onClick={onDiscard} className="text-xs text-slate-500 hover:text-slate-700 font-medium">
          Vazgeç
        </button>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {/* Canlı Dinlenme Zamanlayıcısı */}
        <RestTimer countdown={restTimer} />

        {/* F25: Egzersizler ve "benzeriyle değiştir" */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {[...new Set(form.setLogs.map((s) => s.exerciseName))].map((name) => (
            <span key={name} className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-semibold text-slate-700">{name}</span>
              <ExerciseSwap exerciseName={name} onSwap={(to) => onChange(replaceExercise(form, name, to))} />
            </span>
          ))}
        </div>

        {/* Set Girişleri */}
        <div className="space-y-4">
          {form.setLogs.map((set) => (
            <SetRow
              key={set.key}
              set={set}
              onChange={(patch) => onChange(updateSet(form, set.key, patch))}
              onToggle={() => toggleSet(set.key, !!set.completed)}
            />
          ))}
        </div>

        {/* Seans Notları ve Zorluk Derecesi (RPE) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div>
            <label htmlFor={rpeId} className="block text-xs font-semibold text-slate-700 mb-1">
              Algılanan Zorluk Derecesi (RPE 1 - 10)
            </label>
            <div className="flex items-center gap-3">
              <input
                id={rpeId}
                type="range"
                min="1"
                max="10"
                value={form.rpe}
                onChange={(e) => onChange({ ...form, rpe: parseInt(e.target.value) || 7 })}
                className="flex-1 accent-slate-900"
              />
              <span className="font-bold text-slate-900 text-sm">{form.rpe} / 10</span>
            </div>
          </div>

          <div>
            <label htmlFor={durationId} className="block text-xs font-semibold text-slate-700 mb-1">
              Gerçekleşen Süre (Dakika)
            </label>
            <input
              id={durationId}
              type="number"
              value={form.durationMinutes}
              onChange={(e) => onChange({ ...form, durationMinutes: parseInt(e.target.value) || 30 })}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>
        </div>

        {saveError && (
          <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {saveError}
          </p>
        )}
        {asking && incomplete > 0 && (
          <div
            role="group"
            aria-labelledby={promptId}
            className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-950 space-y-3"
          >
            <p id={promptId} className="text-sm font-bold">
              {incomplete} set tamamlanmadı.
            </p>
            <p className="text-xs text-amber-900">
              Tamamlanmayan setler kaydedilmez; yaptıysan "tamamlandı say" seç.
              {emptyWeightIncomplete && " Ağırlığı boş setler 0 kg (vücut ağırlığı) olarak kaydedilir."}
              {completedCount === 0 && " Henüz tamamlanmış set yok; atarsan kaydedilecek bir şey kalmaz."}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={completedCount === 0 || saving}
                onClick={() => finishWith(form)}
                className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50"
              >
                At ve kaydet
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => finishWith(markAllCompleted(form))}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-bold disabled:opacity-50"
              >
                Tamamlandı say ve kaydet
              </button>
              <button
                type="button"
                onClick={() => setAsking(false)}
                className="px-3 py-2 rounded-xl text-slate-600 text-xs font-semibold hover:bg-amber-100"
              >
                Seansa dön
              </button>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            İptal Et
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl text-sm font-bold bg-brand-600 text-white hover:bg-brand-700 shadow-md disabled:opacity-60"
          >
            {saving ? "Kaydediliyor..." : "Antrenmanı Bitir & Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}
