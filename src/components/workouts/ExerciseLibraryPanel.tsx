"use client";

import { useState } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { errorMessage } from "@/lib/client/api";
import { useCreateExercise, useDeleteExercise, useExerciseAlternatives, useExercises } from "@/lib/client/queries/exercises";
import { EQUIPMENT_KEYS, EQUIPMENT_LABELS, type Equipment, type LibraryExercise } from "@/lib/exercise-library";
import { MUSCLE_GROUPS } from "@/lib/muscles";

const LABEL = "block text-xs font-semibold text-slate-600 mb-1";
const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";
const muscleName = (id: string) => MUSCLE_GROUPS.find((m) => m.muscleId === id)?.nameTr ?? id;

function ExerciseDetail({ exercise }: { exercise: LibraryExercise }) {
  const alts = useExerciseAlternatives(exercise.name);
  return (
    <div className="px-3 pb-3 space-y-2 text-xs text-slate-600">
      {exercise.secondary.length > 0 && <p>Yardımcı kaslar: {exercise.secondary.map(muscleName).join(", ")}</p>}
      <ul className="list-disc pl-4 space-y-0.5">
        {exercise.cues.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      {alts.data && alts.data.alternatives.length > 0 && (
        <p>
          <span className="font-semibold text-slate-700">Benzerleri:</span>{" "}
          {alts.data.alternatives.map((a) => `${a.nameTr} (${EQUIPMENT_LABELS[a.equipment as Equipment] ?? a.equipment})`).join(", ")}
        </p>
      )}
    </div>
  );
}

function CustomExerciseForm({ onDone }: { onDone: () => void }) {
  const create = useCreateExercise();
  const [name, setName] = useState("");
  const [primary, setPrimary] = useState(MUSCLE_GROUPS[0].muscleId);
  const [equipment, setEquipment] = useState<Equipment>("dumbbell");
  const [cues, setCues] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate(
          { name: name.trim(), primary, equipment, cues: cues.split("\n").map((c) => c.trim()).filter(Boolean) },
          { onSuccess: onDone }
        );
      }}
      className="p-4 rounded-xl border border-slate-200 bg-slate-50 grid grid-cols-1 sm:grid-cols-3 gap-3"
    >
      <div>
        <label htmlFor="custom-ex-name" className={LABEL}>
          Ad
        </label>
        <input id="custom-ex-name" required value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
      </div>
      <div>
        <label htmlFor="custom-ex-primary" className={LABEL}>
          Ana kas
        </label>
        <select id="custom-ex-primary" value={primary} onChange={(e) => setPrimary(e.target.value)} className={INPUT}>
          {MUSCLE_GROUPS.map((m) => (
            <option key={m.muscleId} value={m.muscleId}>
              {m.nameTr}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="custom-ex-equipment" className={LABEL}>
          Ekipman
        </label>
        <select id="custom-ex-equipment" value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)} className={INPUT}>
          {EQUIPMENT_KEYS.map((k) => (
            <option key={k} value={k}>
              {EQUIPMENT_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-3">
        <label htmlFor="custom-ex-cues" className={LABEL}>
          İpuçları (her satıra bir tane)
        </label>
        <textarea id="custom-ex-cues" rows={2} value={cues} onChange={(e) => setCues(e.target.value)} className={INPUT} />
      </div>
      {create.isError && (
        <p role="alert" className="sm:col-span-3 text-xs text-rose-700">
          {errorMessage(create.error, "Egzersiz eklenemedi.")}
        </p>
      )}
      <div className="sm:col-span-3 flex justify-end">
        <button type="submit" disabled={create.isPending} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50">
          Egzersizi kaydet
        </button>
      </div>
    </form>
  );
}

/** F25: Egzersiz kütüphanesi: arama, kas ve ekipman süzgeci, ipuçları, benzerleri ve özel egzersiz. */
export function ExerciseLibraryPanel() {
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const list = useExercises({ search, muscle, equipment });
  const remove = useDeleteExercise();

  return (
    <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-brand-600" />
          <h3 className="font-bold text-slate-900 text-base">Egzersiz kütüphanesi</h3>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <Plus className="w-3.5 h-3.5" />
          Özel egzersiz ekle
        </button>
      </div>

      {adding && <CustomExerciseForm onDone={() => setAdding(false)} />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="ex-search" className={LABEL}>
            Egzersiz ara
          </label>
          <input id="ex-search" type="search" value={search} placeholder="Örn: squat, sinav" onChange={(e) => setSearch(e.target.value)} className={INPUT} />
        </div>
        <div>
          <label htmlFor="ex-muscle" className={LABEL}>
            Kas grubu
          </label>
          <select id="ex-muscle" value={muscle} onChange={(e) => setMuscle(e.target.value)} className={INPUT}>
            <option value="">Tümü</option>
            {MUSCLE_GROUPS.map((m) => (
              <option key={m.muscleId} value={m.muscleId}>
                {m.nameTr}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ex-equipment" className={LABEL}>
            Ekipmana göre
          </label>
          <select id="ex-equipment" value={equipment} onChange={(e) => setEquipment(e.target.value)} className={INPUT}>
            <option value="">Tümü</option>
            {EQUIPMENT_KEYS.map((k) => (
              <option key={k} value={k}>
                {EQUIPMENT_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
        {list.data?.map((e) => (
          <li key={e.id}>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-expanded={openId === e.id}
                onClick={() => setOpenId(openId === e.id ? null : e.id)}
                className="flex-1 text-left px-3 py-2.5 hover:bg-slate-50"
              >
                <span className="text-sm font-semibold text-slate-900">{e.nameTr}</span>
                {e.nameTr !== e.name && <span className="text-xs text-slate-400"> · {e.name}</span>}
                <span className="block text-[11px] text-slate-500">
                  {muscleName(e.primary)} · {EQUIPMENT_LABELS[e.equipment as Equipment] ?? e.equipment}
                  {e.isCustom && " · özel"}
                </span>
              </button>
              {e.isCustom && (
                <button
                  type="button"
                  aria-label={`${e.nameTr} özel egzersizini sil`}
                  onClick={() => remove.mutate(e.id)}
                  className="p-2 mr-1 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            {openId === e.id && <ExerciseDetail exercise={e} />}
          </li>
        ))}
        {list.data?.length === 0 && <li className="px-3 py-4 text-sm text-slate-500">Eşleşen egzersiz yok.</li>}
      </ul>
    </section>
  );
}
