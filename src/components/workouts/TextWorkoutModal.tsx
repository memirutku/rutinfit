"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { errorMessage } from "@/lib/client/api";
import { useFinishWorkout, useSaveTemplate } from "@/lib/client/queries/workouts";
import { getLocalWeekday } from "@/lib/date-utils";
import type { TemplateInput } from "@/lib/schemas/workout";
import { parseWorkoutText } from "@/lib/workout-text";

const LABEL = "block text-xs font-semibold text-slate-600 mb-1";
const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";

/**
 * F28: Metinden antrenman. Yazılanlar anında ayrıştırılır ve önizlenir; kullanıcı onaylayınca
 * tamamlanmış seans ya da şablon olarak kaydedilir.
 */
export function TextWorkoutModal({ open, date, onClose }: { open: boolean; date: string; onClose: () => void }) {
  const [text, setText] = useState("");
  const [name, setName] = useState("Serbest antrenman");
  const [duration, setDuration] = useState(45);
  const parsed = useMemo(() => parseWorkoutText(text), [text]);
  const finish = useFinishWorkout();
  const saveTemplate = useSaveTemplate();
  const error = finish.error ?? saveTemplate.error;
  const count = parsed.sets.length;

  const groups = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const s of parsed.sets) map.set(s.exerciseName, [...(map.get(s.exerciseName) ?? []), s.reps]);
    return [...map.entries()];
  }, [parsed.sets]);

  const close = () => {
    setText("");
    onClose();
  };

  function saveSession() {
    finish.mutate(
      {
        date,
        name: name.trim() || "Serbest antrenman",
        durationMinutes: duration,
        completed: true,
        setLogs: parsed.sets.map((s) => ({ exerciseName: s.exerciseName, setNumber: s.setNumber, weightKg: s.weightKg, reps: s.reps, rpe: s.rpe ?? null })),
      },
      { onSuccess: close }
    );
  }

  function saveAsTemplate() {
    const input: TemplateInput = {
      name: name.trim() || "Serbest antrenman",
      type: "strength",
      dayOfWeek: getLocalWeekday(date),
      targetDurationMinutes: duration,
      notes: null,
      exercises: groups.map(([exerciseName, reps]) => ({
        exerciseName,
        targetSets: Math.min(10, reps.length),
        repMin: Math.min(...reps),
        repMax: Math.max(...reps),
        restSeconds: 90,
      })),
    };
    saveTemplate.mutate({ input }, { onSuccess: close });
  }

  return (
    <Modal open={open} onClose={close} title="Metinden antrenman ekle" description="Her satıra bir egzersiz: squat 3x8 80 kg · bench 100x5, 100x5 · şınav 3x15" widthClass="max-w-xl">
      <div className="space-y-3">
        <div>
          <label htmlFor="text-workout" className={LABEL}>
            Antrenman metni
          </label>
          <textarea
            id="text-workout"
            rows={5}
            value={text}
            placeholder={"squat 3x8 80 kg\nbench press 3x5 @ 62,5\ndeadlift 140kg 1x5 rpe 8"}
            onChange={(e) => setText(e.target.value)}
            className={`${INPUT} font-mono`}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="text-workout-name" className={LABEL}>
              Seans adı
            </label>
            <input id="text-workout-name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label htmlFor="text-workout-duration" className={LABEL}>
              Süre (dk)
            </label>
            <input
              id="text-workout-duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value, 10) || 45))}
              className={INPUT}
            />
          </div>
        </div>

        {parsed.lines.length > 0 && (
          <ul aria-label="Önizleme" className="space-y-1 text-xs">
            {parsed.lines.map((l, i) => (
              <li key={`${i}:${l.raw}`} className={`px-2.5 py-1.5 rounded-lg ${l.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-800"}`}>
                <span className="font-mono">{l.raw}</span>
                {l.ok ? (
                  <span className="ml-2 font-semibold">
                    → {l.exerciseName} · {parsed.sets.filter((s) => s.exerciseName === l.exerciseName).length} set
                    {!l.inLibrary && <span className="ml-1 font-normal text-amber-700">(kütüphanede yok)</span>}
                  </span>
                ) : (
                  <span className="ml-2">{l.message}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="text-xs font-semibold text-rose-700">
            {errorMessage(error, "Kaydedilemedi.")}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={count === 0 || saveTemplate.isPending}
            onClick={saveAsTemplate}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-50"
          >
            Şablon olarak kaydet
          </button>
          <button
            type="button"
            disabled={count === 0 || finish.isPending}
            onClick={saveSession}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50"
          >
            Seans olarak kaydet ({count} set)
          </button>
        </div>
      </div>
    </Modal>
  );
}
