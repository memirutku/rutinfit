"use client";

import { useRef, useState, type FormEvent } from "react";
import { useCountdown } from "@/hooks/useCountdown";
import { useToday } from "@/hooks/useToday";
import { errorMessage } from "@/lib/client/api";
import { useFinishWorkout, useWorkouts } from "@/lib/client/queries/workouts";
import type { ProgressionFeedback, WorkoutSession } from "@/lib/schemas/workout";
import { MuscleHeatmap } from "@/components/MuscleHeatmap";
import { PlateCalculator } from "@/components/PlateCalculator";
import { ExerciseLibraryPanel } from "@/components/workouts/ExerciseLibraryPanel";
import { WorkoutTabs, type WorkoutSubTab } from "@/components/workouts/WorkoutTabs";
import { ProgressionFeedbackPanel } from "@/components/workouts/ProgressionFeedbackPanel";
import { DraftResumeBanner } from "@/components/workouts/DraftResumeBanner";
import { ActiveSessionForm } from "@/components/workouts/ActiveSessionForm";
import { WeeklyPlanGrid } from "@/components/workouts/WeeklyPlanGrid";
import { useWorkoutDraft } from "@/components/workouts/useWorkoutDraft";
import {
  buildSessionForm,
  fromDraft,
  toWorkoutPayload,
  type ActiveWorkout,
  type SessionTemplate,
} from "@/components/workouts/session-form";

const NO_SESSIONS: WorkoutSession[] = [];

export default function WorkoutsPage() {
  const [tab, setTab] = useState<WorkoutSubTab>("workouts");
  const workouts = useWorkouts();
  const finish = useFinishWorkout();
  const today = useToday();

  // Dinlenme Zamanlayıcısı: duvar saatine dayalı (arka plan penceresinde kaymaz)
  const restTimer = useCountdown();

  const [active, setActive] = useState<ActiveWorkout | null>(null);
  const [feedback, setFeedback] = useState<Record<string, ProgressionFeedback> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const submitting = useRef(false);

  // Kaldığın Yerden Devam Etme: aktif seans her değiştiğinde taslak kaydedilir
  const draft = useWorkoutDraft(active);

  function startSession(template: SessionTemplate, shortened: boolean) {
    setActive({ template, form: buildSessionForm(template, shortened), shortened });
    setFeedback(null);
  }

  function resumeDraft() {
    if (!draft.savedDraft) return;
    setActive(fromDraft(draft.savedDraft));
    draft.dismiss();
  }

  function discardSession() {
    setActive(null);
    draft.removeStored();
  }

  async function handleFinishSession(e: FormEvent) {
    e.preventDefault();
    if (!active || submitting.current) return; // çift gönderim koruması
    submitting.current = true;
    setSaveError(null);
    try {
      const data = await finish.mutateAsync(toWorkoutPayload(active.form, today));
      setFeedback(data.progressionFeedbacks);
      setActive(null);
      draft.removeStored();
    } catch (err) {
      // Kayıt başarısızsa seans ve yerel taslak korunur; kullanıcı düzeltip tekrar dener.
      setSaveError(`Antrenman kaydedilemedi, verileriniz korunuyor: ${errorMessage(err, "bilinmeyen hata")}`);
    } finally {
      submitting.current = false;
    }
  }

  return (
    <div className="space-y-6">
      <WorkoutTabs tab={tab} onChange={setTab} />

      {/* İlerleme Tavsiyesi Bildirimi (Antrenman bittiğinde) */}
      {feedback && <ProgressionFeedbackPanel feedback={feedback} />}

      {tab === "heatmap" && <MuscleHeatmap workoutSessions={workouts.data?.sessions ?? NO_SESSIONS} />}

      {tab === "plates" && <PlateCalculator />}

      {tab === "library" && <ExerciseLibraryPanel />}

      {tab === "workouts" && (
        <>
          {draft.savedDraft && !active && (
            <DraftResumeBanner draft={draft.savedDraft} onResume={resumeDraft} onDiscard={draft.discard} />
          )}

          {active && (
            <ActiveSessionForm
              form={active.form}
              onChange={(form) => setActive((prev) => (prev ? { ...prev, form } : prev))}
              restTimer={restTimer}
              saving={finish.isPending}
              saveError={saveError}
              onSubmit={handleFinishSession}
              onDiscard={discardSession}
              onClose={() => setActive(null)}
            />
          )}

          <WeeklyPlanGrid
            templates={workouts.data?.templates ?? []}
            loading={workouts.isPending}
            onStart={startSession}
          />
        </>
      )}
    </div>
  );
}
