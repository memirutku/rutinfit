"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { clientId } from "@/lib/client/keys";
import { errorMessage } from "@/lib/client/api";
import { useUpdateWorkout } from "@/lib/client/queries/workouts";
import { isDateString } from "@/lib/date-utils";
import type { WorkoutSession } from "@/lib/schemas/workout";
import { normalizeSetType, SET_TYPES, SET_TYPE_LABELS, type SetType } from "@/lib/set-types";
import { groupSetLogs } from "./session-history";

interface EditRow {
  key: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  setType: SetType;
  rpe: number | null;
}

interface EditForm {
  date: string;
  name: string;
  durationMinutes: number;
  rows: EditRow[];
}

const LABEL = "block text-xs font-semibold text-slate-600 mb-1";
const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";
const CELL = "w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-center";

function toForm(session: WorkoutSession): EditForm {
  return {
    date: session.date,
    name: session.name,
    durationMinutes: session.durationMinutes,
    rows: groupSetLogs(session.setLogs).flatMap((g) =>
      g.sets.map((s) => ({
        key: clientId("edit-set"),
        exerciseName: s.exerciseName,
        weightKg: s.weightKg,
        reps: s.reps,
        setType: normalizeSetType(s.setType),
        rpe: s.rpe ?? null,
      }))
    ),
  };
}

/** B19: Geçmiş seansı düzenleme penceresi: tarih, ad, süre ve set başına ağırlık, tekrar, tip; set silme. */
export function EditSessionModal({ session, today, onClose }: { session: WorkoutSession | null; today: string; onClose: () => void }) {
  const update = useUpdateWorkout();
  const [form, setForm] = useState<EditForm | null>(() => (session ? toForm(session) : null));
  const [seed, setSeed] = useState(session);
  if (seed !== session) {
    setSeed(session);
    setForm(session ? toForm(session) : null);
  }
  const close = () => {
    update.reset();
    onClose();
  };

  const setRow = (key: string, patch: Partial<EditRow>) =>
    setForm((f) => (f ? { ...f, rows: f.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) } : f));

  const problem = !form
    ? null
    : !isDateString(form.date)
      ? "Geçerli bir tarih seçin."
      : form.date > today
        ? "Gelecek bir gün seçilemez."
        : !form.name.trim()
          ? "Seans adı boş olamaz."
          : form.rows.length === 0
            ? "En az bir set kalmalı. Seansı tümüyle kaldırmak için listede 'Sil'i kullanın."
            : form.rows.some((r) => !(r.reps >= 1))
              ? "Her setin tekrarı en az 1 olmalı."
              : null;

  function save() {
    if (!session || !form || problem) return;
    const counters = new Map<string, number>();
    update.mutate(
      {
        id: session.id,
        input: {
          date: form.date,
          name: form.name.trim(),
          durationMinutes: form.durationMinutes,
          rpe: session.rpe,
          notes: session.notes,
          completed: true,
          setLogs: form.rows.map((r) => {
            const setNumber = (counters.get(r.exerciseName) ?? 0) + 1;
            counters.set(r.exerciseName, setNumber);
            return { exerciseName: r.exerciseName, setNumber, weightKg: r.weightKg, reps: r.reps, setType: r.setType, rpe: r.rpe };
          }),
        },
      },
      { onSuccess: close }
    );
  }

  // Satır etiketleri: egzersiz içindeki sıra ("Squat 2. set ağırlık").
  const positions = new Map<string, number>();
  const counters = new Map<string, number>();
  for (const r of form?.rows ?? []) {
    const n = (counters.get(r.exerciseName) ?? 0) + 1;
    counters.set(r.exerciseName, n);
    positions.set(r.key, n);
  }

  return (
    <Modal open={!!session && !!form} onClose={close} title="Seansı düzenle" widthClass="max-w-2xl">
      {form && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="edit-session-date" className={LABEL}>
                Tarih
              </label>
              <input
                id="edit-session-date"
                type="date"
                value={form.date}
                max={today}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className={INPUT}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="edit-session-name" className={LABEL}>
                Seans adı
              </label>
              <input id="edit-session-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label htmlFor="edit-session-duration" className={LABEL}>
                Süre (dk)
              </label>
              <input
                id="edit-session-duration"
                type="number"
                min={0}
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                className={INPUT}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <caption className="sr-only">Setler</caption>
              <thead>
                <tr className="text-left text-slate-500">
                  <th scope="col" className="py-1">Egzersiz</th>
                  <th scope="col" className="py-1 w-12 text-center">Set</th>
                  <th scope="col" className="py-1 w-20 text-center">Ağırlık (kg)</th>
                  <th scope="col" className="py-1 w-16 text-center">Tekrar</th>
                  <th scope="col" className="py-1 w-24 text-center">Tip</th>
                  <th scope="col" className="py-1 w-8" />
                </tr>
              </thead>
              <tbody>
                {form.rows.map((r) => {
                  const label = `${r.exerciseName} ${positions.get(r.key)}. set`;
                  return (
                    <tr key={r.key}>
                      <td className="py-1 pr-1 font-semibold text-slate-800">{r.exerciseName}</td>
                      <td className="py-1 text-center text-slate-500">{positions.get(r.key)}</td>
                      <td className="py-1 px-0.5">
                        <DecimalInput
                          aria-label={`${label} ağırlık`}
                          value={r.weightKg}
                          onValueChange={(v) => setRow(r.key, { weightKg: Math.max(0, v) })}
                          className={CELL}
                        />
                      </td>
                      <td className="py-1 px-0.5">
                        <input
                          aria-label={`${label} tekrar`}
                          type="number"
                          min={1}
                          value={r.reps}
                          onChange={(e) => setRow(r.key, { reps: parseInt(e.target.value, 10) || 0 })}
                          className={CELL}
                        />
                      </td>
                      <td className="py-1 px-0.5">
                        <select
                          aria-label={`${label} tipi`}
                          value={r.setType}
                          onChange={(e) => setRow(r.key, { setType: e.target.value as SetType })}
                          className={CELL}
                        >
                          {SET_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {SET_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 pl-1">
                        <button
                          type="button"
                          aria-label={`${r.exerciseName} ${positions.get(r.key)}. seti sil`}
                          onClick={() => setForm({ ...form, rows: form.rows.filter((x) => x.key !== r.key) })}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(problem || update.isError) && (
            <p role="alert" className="text-xs font-semibold text-rose-700">
              {problem ?? errorMessage(update.error, "Seans kaydedilemedi.")}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={close} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100">
              Vazgeç
            </button>
            <button
              type="button"
              disabled={!!problem || update.isPending}
              onClick={save}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50"
            >
              Değişiklikleri kaydet
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
