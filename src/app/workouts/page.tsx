"use client";

import { useMemo, useRef, useState } from "react";
import { useCountdown } from "@/hooks/useCountdown";
import { useToday } from "@/hooks/useToday";
import { errorMessage } from "@/lib/client/api";
import { useFinishWorkout, useLastSets, useWorkouts } from "@/lib/client/queries/workouts";
import type { ProgressionFeedback, WorkoutSession, WorkoutTemplate } from "@/lib/schemas/workout";
import { TemplateEditor } from "@/components/workouts/TemplateEditor";
import { ProgramPicker } from "@/components/workouts/ProgramPicker";
import { TextWorkoutModal } from "@/components/workouts/TextWorkoutModal";
import { MuscleHeatmap } from "@/components/MuscleHeatmap";
import { PlateCalculator } from "@/components/PlateCalculator";
import { ExerciseLibraryPanel } from "@/components/workouts/ExerciseLibraryPanel";
import { CardioPanel } from "@/components/workouts/CardioPanel";
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
  type SessionForm,
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
  // F17: şablon editörü (null: kapalı)
  const [pickingProgram, setPickingProgram] = useState(false);
  const [textEntry, setTextEntry] = useState(false);
  const [editing, setEditing] = useState<{ template: WorkoutTemplate | null; dayOfWeek: number } | null>(null);
  const submitting = useRef(false);

  // Kaldığın Yerden Devam Etme: aktif seans her değiştiğinde taslak kaydedilir
  const draft = useWorkoutDraft(active);

  // B17: şablonlardaki egzersizlerin son seans ağırlıkları önceden yüklenir; seans boş ya da
  // önceki ağırlıklarla açılır (sabit varsayılan yok).
  const templates = workouts.data?.templates;
  const exerciseNames = useMemo(() => (templates ?? []).flatMap((t) => t.exercises.map((e) => e.exerciseName)), [templates]);
  const lastSets = useLastSets(exerciseNames);

  function startSession(template: SessionTemplate, shortened: boolean) {
    setActive({ template, form: buildSessionForm(template, shortened, lastSets.data), shortened });
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

  async function handleFinishSession(form: SessionForm) {
    if (!active || submitting.current) return; // çift gönderim koruması
    submitting.current = true;
    setSaveError(null);
    try {
      const data = await finish.mutateAsync(toWorkoutPayload(form, today));
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

      {tab === "cardio" && <CardioPanel today={today} />}

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
              onFinish={handleFinishSession}
              onDiscard={discardSession}
              onClose={() => setActive(null)}
            />
          )}

          <WeeklyPlanGrid
            templates={workouts.data?.templates ?? []}
            loading={workouts.isPending}
            onStart={startSession}
            onEdit={(template, dayOfWeek) => setEditing({ template, dayOfWeek })}
            onPickProgram={() => setPickingProgram(true)}
            onTextEntry={() => setTextEntry(true)}
          />
          <TextWorkoutModal open={textEntry} date={today} onClose={() => setTextEntry(false)} />
          <ProgramPicker open={pickingProgram} onClose={() => setPickingProgram(false)} />
          <TemplateEditor
            open={editing !== null}
            template={editing?.template ?? null}
            dayOfWeek={editing?.dayOfWeek ?? 1}
            onClose={() => setEditing(null)}
          />
        </>
      )}
    </div>
  );
}
