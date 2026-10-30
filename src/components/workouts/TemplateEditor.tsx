"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { errorMessage } from "@/lib/client/api";
import { useExercises } from "@/lib/client/queries/exercises";
import { useDeleteTemplate, useSaveTemplate } from "@/lib/client/queries/workouts";
import { clientId } from "@/lib/client/keys";
import type { TemplateInput, WorkoutTemplate } from "@/lib/schemas/workout";
import { DAYS_OF_WEEK } from "./WeeklyPlanGrid";
import { DecimalInput } from "@/components/ui/DecimalInput";

interface TemplateEditorProps {
  open: boolean;
  /** Düzenlenen şablon; null ise yeni şablon. */
  template: WorkoutTemplate | null;
  /** Yeni şablonun günü. */
  dayOfWeek: number;
  onClose: () => void;
}

interface Row {
  key: string;
  exerciseName: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  incrementKg: number;
}

const LABEL = "block text-xs font-semibold text-slate-600 mb-1";
const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";
const CELL = "w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-center";
const TYPES = [
  { value: "strength", label: "Ağırlık seansı" },
  { value: "easy_run", label: "Kolay koşu" },
  { value: "rest", label: "Dinlenme" },
] as const;

const newRow = (): Row => ({ key: clientId("row"), exerciseName: "", targetSets: 3, repMin: 8, repMax: 12, restSeconds: 90, incrementKg: 2.5 });
const int = (v: string, fallback: number) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : fallback);

/** F17: Şablon/program editörü: ad, tür, gün, süre, not ve sıralanabilir egzersiz listesi. */
export function TemplateEditor({ open, template, dayOfWeek, onClose }: TemplateEditorProps) {
  const init = () => ({
    name: template?.name ?? "",
    type: (template?.type ?? "strength") as TemplateInput["type"],
    dayOfWeek: template?.dayOfWeek ?? dayOfWeek,
    targetDurationMinutes: template?.targetDurationMinutes ?? 45,
    notes: template?.notes ?? "",
    rows: (template?.exercises ?? []).map((e) => ({ ...e, incrementKg: e.incrementKg ?? 2.5, key: e.id })) as Row[],
  });
  const [form, setForm] = useState(init);
  const [seed, setSeed] = useState({ template, dayOfWeek, open });
  if (seed.template !== template || seed.dayOfWeek !== dayOfWeek || seed.open !== open) {
    setSeed({ template, dayOfWeek, open });
    setForm(init());
  }
  const [confirmDelete, setConfirmDelete] = useState(false);
  const library = useExercises({ search: "", muscle: "", equipment: "" }, { enabled: open });
  const save = useSaveTemplate();
  const remove = useDeleteTemplate();
  const error = save.error ?? remove.error;

  const setRow = (key: string, patch: Partial<Row>) =>
    setForm((f) => ({ ...f, rows: f.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
  const move = (i: number, d: -1 | 1) =>
    setForm((f) => {
      const rows = [...f.rows];
      [rows[i], rows[i + d]] = [rows[i + d], rows[i]];
      return { ...f, rows };
    });

  function submit() {
    const input: TemplateInput = {
      name: form.name.trim(),
      type: form.type,
      dayOfWeek: form.dayOfWeek,
      targetDurationMinutes: form.targetDurationMinutes,
      notes: form.notes.trim() || null,
      // Adı boş satırlar (yeni eklenip doldurulmamış) gönderilmez.
      exercises: form.rows
        .filter((r) => r.exerciseName.trim())
        .map(({ exerciseName, targetSets, repMin, repMax, restSeconds, incrementKg }) => ({
          exerciseName: exerciseName.trim(),
          targetSets,
          repMin,
          repMax,
          restSeconds,
          incrementKg,
        })),
    };
    save.mutate({ id: template?.id, input }, { onSuccess: onClose });
  }

  return (
    <Modal open={open} onClose={onClose} title={template ? "Şablonu düzenle" : "Yeni şablon"} widthClass="max-w-3xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label htmlFor="tpl-name" className={LABEL}>
              Şablon adı
            </label>
            <input id="tpl-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT} />
          </div>
          <div>
            <label htmlFor="tpl-type" className={LABEL}>
              Tür
            </label>
            <select id="tpl-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as TemplateInput["type"] })} className={INPUT}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tpl-day" className={LABEL}>
              Gün
            </label>
            <select id="tpl-day" value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })} className={INPUT}>
              {DAYS_OF_WEEK.map((d) => (
                <option key={d.day} value={d.day}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tpl-duration" className={LABEL}>
              Süre (dk)
            </label>
            <input
              id="tpl-duration"
              type="number"
              value={form.targetDurationMinutes}
              onChange={(e) => setForm({ ...form, targetDurationMinutes: int(e.target.value, 45) })}
              className={INPUT}
            />
          </div>
          <div className="col-span-2 sm:col-span-3">
            <label htmlFor="tpl-notes" className={LABEL}>
              Not
            </label>
            <input id="tpl-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={INPUT} />
          </div>
        </div>

        <datalist id="tpl-exercise-names">
          {library.data?.map((e) => (
            <option key={e.id} value={e.name}>
              {e.nameTr}
            </option>
          ))}
        </datalist>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">Egzersizler</caption>
            <thead>
              <tr className="text-left text-slate-500">
                <th scope="col" className="py-1">Egzersiz</th>
                <th scope="col" className="py-1 w-16 text-center">Set</th>
                <th scope="col" className="py-1 w-16 text-center">Min tk</th>
                <th scope="col" className="py-1 w-16 text-center">Maks tk</th>
                <th scope="col" className="py-1 w-20 text-center">Dinlenme (sn)</th>
                <th scope="col" className="py-1 w-16 text-center">Artış (kg)</th>
                <th scope="col" className="py-1 w-24" />
              </tr>
            </thead>
            <tbody>
              {form.rows.map((r, i) => {
                const label = r.exerciseName || `Egzersiz ${i + 1}`;
                return (
                  <tr key={r.key}>
                    <td className="py-1 pr-1">
                      <input
                        aria-label={`Egzersiz ${i + 1} adı`}
                        list="tpl-exercise-names"
                        value={r.exerciseName}
                        onChange={(e) => setRow(r.key, { exerciseName: e.target.value })}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </td>
                    <td className="py-1 px-0.5">
                      <input aria-label={`${label} set sayısı`} type="number" value={r.targetSets} onChange={(e) => setRow(r.key, { targetSets: int(e.target.value, 3) })} className={CELL} />
                    </td>
                    <td className="py-1 px-0.5">
                      <input aria-label={`${label} en az tekrar`} type="number" value={r.repMin} onChange={(e) => setRow(r.key, { repMin: int(e.target.value, 8) })} className={CELL} />
                    </td>
                    <td className="py-1 px-0.5">
                      <input aria-label={`${label} en çok tekrar`} type="number" value={r.repMax} onChange={(e) => setRow(r.key, { repMax: int(e.target.value, 12) })} className={CELL} />
                    </td>
                    <td className="py-1 px-0.5">
                      <input aria-label={`${label} dinlenme`} type="number" value={r.restSeconds} onChange={(e) => setRow(r.key, { restSeconds: int(e.target.value, 90) })} className={CELL} />
                    </td>
                    <td className="py-1 px-0.5">
                      <DecimalInput
                        aria-label={`${label} artış (kg)`}
                        value={r.incrementKg}
                        onValueChange={(v) => setRow(r.key, { incrementKg: Math.max(0, v) })}
                        className={CELL}
                      />
                    </td>
                    <td className="py-1 pl-1 whitespace-nowrap">
                      <button type="button" aria-label={`${label} yukarı taşı`} disabled={i === 0} onClick={() => move(i, -1)} className="p-1 text-slate-500 disabled:opacity-30">
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" aria-label={`${label} aşağı taşı`} disabled={i === form.rows.length - 1} onClick={() => move(i, 1)} className="p-1 text-slate-500 disabled:opacity-30">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`${label} çıkar`}
                        onClick={() => setForm((f) => ({ ...f, rows: f.rows.filter((x) => x.key !== r.key) }))}
                        className="p-1 text-slate-500 hover:text-rose-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, rows: [...f.rows, newRow()] }))}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <Plus className="w-3.5 h-3.5" />
          Egzersiz ekle
        </button>

        {error && (
          <p role="alert" className="text-xs font-semibold text-rose-700">
            {errorMessage(error, "Şablon kaydedilemedi.")}
          </p>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          {template ? (
            confirmDelete ? (
              <button
                type="button"
                onClick={() => remove.mutate(template.id, { onSuccess: onClose })}
                className="px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold"
              >
                Silmeyi onayla
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="px-3 py-2 rounded-xl text-rose-700 text-xs font-bold hover:bg-rose-50">
                Şablonu sil
              </button>
            )
          ) : (
            <span />
          )}
          <button
            type="button"
            disabled={save.isPending || !form.name.trim()}
            onClick={submit}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50"
          >
            Şablonu kaydet
          </button>
        </div>
      </div>
    </Modal>
  );
}
