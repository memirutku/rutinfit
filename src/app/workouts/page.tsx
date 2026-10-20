"use client";

import { useEffect, useState } from "react";
import { useCountdown } from "@/hooks/useCountdown";
import { RestTimer } from "@/components/workouts/RestTimer";
import {
  Dumbbell,
  CheckCircle2,
  Sparkles,
  Layers,
  Calculator,
} from "lucide-react";
import { MuscleHeatmap } from "@/components/MuscleHeatmap";
import { PlateCalculator } from "@/components/PlateCalculator";
import { getLocalDateString } from "@/lib/date-utils";

export default function WorkoutsPage() {
  const [workoutSubTab, setWorkoutSubTab] = useState<"workouts" | "heatmap" | "plates">("workouts");
  const [templates, setTemplates] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [progressionFeedback, setProgressionFeedback] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isShortenedMode, setIsShortenedMode] = useState(false);

  // Dinlenme Zamanlayıcısı: duvar saatine dayalı (arka plan penceresinde kaymaz)
  const restTimer = useCountdown();

  // Kaldığın Yerden Devam Etme (Draft Persistence)
  const [savedDraft, setSavedDraft] = useState<{
    activeSession: any;
    sessionForm: any;
    isShortenedMode: boolean;
  } | null>(null);

  // Aktif seans formu
  const [sessionForm, setSessionForm] = useState<{
    templateId: string;
    name: string;
    durationMinutes: number;
    rpe: number;
    notes: string;
    setLogs: {
      exerciseName: string;
      setNumber: number;
      weightKg: number;
      reps: number;
      targetRepMin: number;
      targetRepMax: number;
      completed?: boolean;
    }[];
  }>({
    templateId: "",
    name: "",
    durationMinutes: 35,
    rpe: 7,
    notes: "",
    setLogs: [],
  });

  const todayStr = getLocalDateString();

  useEffect(() => {
    loadWorkouts();
    try {
      const draftStr = localStorage.getItem("rutinfit_active_workout_draft");
      if (draftStr) {
        const parsed = JSON.parse(draftStr);
        if (parsed && parsed.sessionForm && parsed.activeSession) {
          setSavedDraft(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Aktif seans değiştikçe localStorage'a otomatik kaydet
  useEffect(() => {
    if (activeSession && sessionForm.name) {
      try {
        localStorage.setItem(
          "rutinfit_active_workout_draft",
          JSON.stringify({ activeSession, sessionForm, isShortenedMode })
        );
      } catch {
        // ignore
      }
    }
  }, [activeSession, sessionForm, isShortenedMode]);

  async function loadWorkouts() {
    setLoading(true);
    try {
      const res = await fetch("/api/workouts");
      const data = await res.json();
      setTemplates(data.templates || []);
      setSessions(data.sessions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function handleResumeDraft() {
    if (!savedDraft) return;
    setActiveSession(savedDraft.activeSession);
    setSessionForm(savedDraft.sessionForm);
    setIsShortenedMode(savedDraft.isShortenedMode || false);
    setSavedDraft(null);
  }

  function handleDiscardDraft() {
    setSavedDraft(null);
    try {
      localStorage.removeItem("rutinfit_active_workout_draft");
    } catch {
      // ignore
    }
  }

  function handleCancelSession() {
    setActiveSession(null);
    try {
      localStorage.removeItem("rutinfit_active_workout_draft");
    } catch {
      // ignore
    }
  }

  function toggleSetCompleted(idx: number) {
    const updatedSets = [...sessionForm.setLogs];
    const nextCompleted = !updatedSets[idx].completed;
    updatedSets[idx].completed = nextCompleted;
    setSessionForm({ ...sessionForm, setLogs: updatedSets });

    if (nextCompleted) {
      // Otomatik dinlenme sayacını başlat (son seçilen süreyle)
      restTimer.start(restTimer.totalSeconds || 90);
    }
  }

  function startSession(template: any, shortened: boolean = false) {
    setIsShortenedMode(shortened);
    const sets: any[] = [];

    // Eğer hafifletilmiş mod seçildiyse: set sayısını 2'ye düşür, egzersizlerin ilk 3-4 tanesini al
    const exercisesToInclude = shortened
      ? template.exercises.slice(0, 3)
      : template.exercises;
    const setsPerExercise = shortened ? 2 : 3;

    for (const ex of exercisesToInclude) {
      for (let s = 1; s <= setsPerExercise; s++) {
        sets.push({
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

    setSessionForm({
      templateId: template.id,
      name: shortened
        ? `${template.name} (25 dk Hafifletilmiş)`
        : template.name,
      durationMinutes: shortened ? 25 : template.targetDurationMinutes,
      rpe: shortened ? 5 : 7,
      notes: shortened
        ? "İş çıkışı yorgunluk nedeniyle kısaltılmış seans uygulandı."
        : "",
      setLogs: sets,
    });
    setActiveSession(template);
    setProgressionFeedback(null);
  }

  async function handleFinishSession(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return; // çift gönderim koruması
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        date: todayStr,
        templateId: sessionForm.templateId || undefined,
        name: sessionForm.name,
        durationMinutes: sessionForm.durationMinutes,
        rpe: sessionForm.rpe,
        notes: sessionForm.notes,
        completed: true,
        setLogs: sessionForm.setLogs.map((s) => ({
          exerciseName: s.exerciseName,
          setNumber: s.setNumber,
          weightKg: s.weightKg,
          reps: s.reps,
          targetRepMin: s.targetRepMin,
          targetRepMax: s.targetRepMax,
          isTargetMet: s.completed ?? (s.reps >= s.targetRepMin),
        })),
      };

      const res = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Kayıt başarısızsa seans ve yerel taslak korunur; kullanıcı düzeltip tekrar dener.
        throw new Error(data.error || `Sunucu hatası (${res.status})`);
      }
      setProgressionFeedback(data.progressionFeedbacks);
      setActiveSession(null);
      try {
        localStorage.removeItem("rutinfit_active_workout_draft");
      } catch {
        // ignore
      }
      loadWorkouts();
    } catch (e: any) {
      console.error("Antrenman bitirme hatası:", e);
      setSaveError(`Antrenman kaydedilemedi, verileriniz korunuyor: ${e?.message || "bilinmeyen hata"}`);
    } finally {
      setSaving(false);
    }
  }

  const daysOfWeekLabels = [
    { day: 1, name: "Pazartesi" },
    { day: 2, name: "Salı" },
    { day: 3, name: "Çarşamba" },
    { day: 4, name: "Perşembe" },
    { day: 5, name: "Cuma" },
    { day: 6, name: "Cumartesi" },
    { day: 7, name: "Pazar" },
  ];

  return (
    <div className="space-y-6">
      {/* Üst Başlık & Sekmeler */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Haftalık Antrenman & İlerleme 🏋️
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            3 Ağırlık (A/B/C) + 2 Kolay Koşu + 2 Dinlenme · İş çıkışı 19:40 ritmi
          </p>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setWorkoutSubTab("workouts")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
              workoutSubTab === "workouts"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Dumbbell className="w-4 h-4 text-brand-600" />
            <span>Şablonlar & Seans</span>
          </button>

          <button
            onClick={() => setWorkoutSubTab("heatmap")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
              workoutSubTab === "heatmap"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Kas Haritası</span>
          </button>

          <button
            onClick={() => setWorkoutSubTab("plates")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
              workoutSubTab === "plates"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calculator className="w-4 h-4 text-emerald-600" />
            <span>Plaka & 1RM</span>
          </button>
        </div>
      </div>

      {/* İlerleme Tavsiyesi Bildirimi (Antrenman bittiğinde) */}
      {progressionFeedback && (
        <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-emerald-950 text-base">
              Tebrikler! Seans Tamamlandı & İlerleme Analizi
            </h3>
          </div>
          <div className="space-y-2 mt-3">
            {Object.entries(progressionFeedback).map(([exName, fb]: [string, any]) => (
              <div
                key={exName}
                className="bg-white/80 p-3 rounded-xl border border-emerald-100 text-xs"
              >
                <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                  <span>{exName}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] ${
                      fb.isTargetMetAllSets
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {fb.isTargetMetAllSets ? "Ağırlık Artışı Önerisi" : "Ağırlığı Koru"}
                  </span>
                </div>
                <p className="text-slate-600">{fb.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1. KAS HARİTASI SEKMESİ */}
      {workoutSubTab === "heatmap" && <MuscleHeatmap workoutSessions={sessions} />}

      {/* 2. PLAKA & 1RM HESAPLAYICI SEKMESİ */}
      {workoutSubTab === "plates" && <PlateCalculator />}

      {/* 3. ANTRENMAN ŞABLONLARI & SEANS SEKMESİ */}
      {workoutSubTab === "workouts" && (
        <>
          {/* Kaldığın Yerden Devam Etme Bildirimi */}
          {savedDraft && !activeSession && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
                  <Dumbbell className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-950">
                    Yarım Kalan Antrenmanınız Bulundu: {savedDraft.sessionForm?.name}
                  </h4>
                  <p className="text-xs text-amber-700">
                    {savedDraft.sessionForm?.setLogs?.filter((s: any) => s.completed).length || 0} / {savedDraft.sessionForm?.setLogs?.length || 0} set tamamlandı.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResumeDraft}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs"
                >
                  Kaldığın Yerden Devam Et
                </button>
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="px-3 py-2 rounded-xl text-slate-500 hover:text-slate-700 text-xs font-semibold"
                >
                  Vazgeç
                </button>
              </div>
            </div>
          )}

          {/* AKTİF SEANS GİRİŞ MODU */}
          {activeSession ? (
            <div className="bg-white p-6 rounded-2xl border border-brand-300 shadow-md space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <h3 className="text-lg font-bold text-slate-900">
                  {sessionForm.name}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Hedef: {sessionForm.durationMinutes} dakika · Her setin ağırlık ve tekrarını kaydedin.
              </p>
            </div>
            <button
              onClick={handleCancelSession}
              className="text-xs text-slate-500 hover:text-slate-700 font-medium"
            >
              Vazgeç
            </button>
          </div>

          <form onSubmit={handleFinishSession} className="space-y-6">
            {/* Canlı Dinlenme Zamanlayıcısı */}
            <RestTimer countdown={restTimer} />

            {/* Set Girişleri */}
            <div className="space-y-4">
              {sessionForm.setLogs.map((set, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border gap-3 transition-colors ${
                    set.completed
                      ? "bg-emerald-50/70 border-emerald-300"
                      : "bg-slate-50 border-slate-200/80"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 ${
                        set.completed
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-900 text-white"
                      }`}
                    >
                      {set.setNumber}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">
                        {set.exerciseName}
                      </p>
                      <p className="text-xs text-slate-400">
                        Hedef tekrar: {set.targetRepMin} - {set.targetRepMax}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">
                        Ağırlık:
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={set.weightKg}
                        onChange={(e) => {
                          const updated = [...sessionForm.setLogs];
                          updated[idx].weightKg = parseFloat(e.target.value) || 0;
                          setSessionForm({ ...sessionForm, setLogs: updated });
                        }}
                        className="w-20 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900 text-center"
                      />
                      <span className="text-xs text-slate-400">kg</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">
                        Tekrar:
                      </label>
                      <input
                        type="number"
                        value={set.reps}
                        onChange={(e) => {
                          const updated = [...sessionForm.setLogs];
                          updated[idx].reps = parseInt(e.target.value) || 0;
                          setSessionForm({ ...sessionForm, setLogs: updated });
                        }}
                        className="w-16 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900 text-center"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleSetCompleted(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 ${
                        set.completed
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                          : "bg-white hover:bg-slate-100 border border-slate-300 text-slate-700"
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{set.completed ? "Tamamlandı" : "Tamamla"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Seans Notları ve Zorluk Derecesi (RPE) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Algılanan Zorluk Derecesi (RPE 1 - 10)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={sessionForm.rpe}
                    onChange={(e) =>
                      setSessionForm({
                        ...sessionForm,
                        rpe: parseInt(e.target.value) || 7,
                      })
                    }
                    className="flex-1 accent-slate-900"
                  />
                  <span className="font-bold text-slate-900 text-sm">
                    {sessionForm.rpe} / 10
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Gerçekleşen Süre (Dakika)
                </label>
                <input
                  type="number"
                  value={sessionForm.durationMinutes}
                  onChange={(e) =>
                    setSessionForm({
                      ...sessionForm,
                      durationMinutes: parseInt(e.target.value) || 30,
                    })
                  }
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
            </div>

            {saveError && (
              <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {saveError}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveSession(null)}
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
      ) : null}

      {/* HAFTALIK TAKVİM VE ŞABLONLAR */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-900 text-base">
          Haftalık Antrenman Planı (3+2+2)
        </h3>
        {loading && (
          <p role="status" className="text-sm text-slate-500">
            Antrenman planı yükleniyor...
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {daysOfWeekLabels.map((d) => {
            const template = templates.find((t) => t.dayOfWeek === d.day);
            const isStrength = template?.type === "strength";
            const isRun = template?.type === "easy_run";

            return (
              <div
                key={d.day}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {d.name}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        isStrength
                          ? "bg-indigo-50 text-indigo-700"
                          : isRun
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {isStrength
                        ? "Ağırlık Seansı"
                        : isRun
                        ? "Kolay Koşu"
                        : "Dinlenme"}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-base mb-1">
                    {template?.name || "Dinlenme"}
                  </h4>
                  <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                    {template?.notes || "Toparlanma günü."}
                  </p>

                  {/* Hareketler listesi */}
                  {template?.exercises && template.exercises.length > 0 && (
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-4 text-xs">
                      <p className="font-semibold text-slate-700 mb-1">
                        Hareketler ({template.exercises.length}):
                      </p>
                      <ul className="space-y-0.5 text-slate-600">
                        {template.exercises.map((ex: any) => (
                          <li key={ex.id} className="truncate">
                            • {ex.exerciseName} ({ex.targetSets} set ×{" "}
                            {ex.repMin}-{ex.repMax} tk)
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {isStrength && (
                  <div className="pt-3 border-t border-slate-100 flex gap-2">
                    <button
                      onClick={() => startSession(template, false)}
                      className="flex-1 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
                    >
                      Başla ({template.targetDurationMinutes} dk)
                    </button>
                    <button
                      onClick={() => startSession(template, true)}
                      title="Yorgun hissediyorsanız 25 dk hafifletilmiş seans"
                      className="py-2 px-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
                    >
                      25 dk Hafiflet
                    </button>
                  </div>
                )}

                {isRun && (
                  <div className="pt-3 border-t border-slate-100">
                    <button
                      onClick={() =>
                        startSession(
                          {
                            ...template,
                            exercises: [
                              {
                                exerciseName: "Kolay Koşu (Konuşma Temposu)",
                                repMin: 25,
                                repMax: 35,
                              },
                            ],
                          },
                          false
                        )
                      }
                      className="w-full py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
                    >
                      Koşu Seansı Kaydet (25-35 dk)
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </>
    )}
    </div>
  );
}

