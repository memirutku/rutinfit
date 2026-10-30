"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { errorMessage } from "@/lib/client/api";
import { useDeleteMeasure, useFoodMeasures, useSaveMeasure } from "@/lib/client/queries/measures";
import { formatNumberTr } from "@/lib/format";
import { MEASURE_NAMES, type MeasureName } from "@/lib/measures";

const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";

/** F73: Besinin ev ölçüleri; kullanıcı kendi tartımını ekler (yerleşik değerin yerine geçer). */
export function MeasuresModal({ open, food, onClose }: { open: boolean; food: { id: string; name: string } | null; onClose: () => void }) {
  const measures = useFoodMeasures(open && food ? food.id : null);
  const save = useSaveMeasure();
  const remove = useDeleteMeasure();
  const [name, setName] = useState<MeasureName>("yemek kaşığı");
  const [grams, setGrams] = useState(0);
  const error = save.error ?? remove.error;

  return (
    <Modal open={open} onClose={onClose} title={`${food?.name ?? ""} · ev ölçüleri`} description="Kendi kaşık ve bardağını tartarak daha doğru ölçü ekleyebilirsin.">
      <div className="space-y-4">
        <ul className="divide-y divide-slate-100 text-sm">
          {measures.data?.measures.map((m) => (
            <li key={m.name} className="flex items-center justify-between py-2">
              <span>
                {m.name} · {formatNumberTr(m.grams)} g{m.source === "custom" && <span className="text-emerald-700"> · senin tartımın</span>}
              </span>
              {m.source === "custom" && m.id && (
                <button type="button" aria-label={`${m.name} ölçüsünü sil`} onClick={() => remove.mutate(m.id!)} className="p-1 text-slate-400 hover:text-rose-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
          {measures.data?.measures.length === 0 && <li className="py-2 text-slate-500">Bu besin için hazır ölçü yok.</li>}
        </ul>
        <div className="grid grid-cols-3 gap-2 items-end">
          <div>
            <label htmlFor="measure-name" className="block text-xs font-semibold text-slate-600 mb-1">
              Ölçü
            </label>
            <select id="measure-name" value={name} onChange={(e) => setName(e.target.value as MeasureName)} className={INPUT}>
              {MEASURE_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="measure-grams" className="block text-xs font-semibold text-slate-600 mb-1">
              Gram
            </label>
            <DecimalInput id="measure-grams" value={grams || null} onValueChange={setGrams} className={INPUT} />
          </div>
          <button
            type="button"
            disabled={!food || !(grams > 0) || save.isPending}
            onClick={() => food && save.mutate({ foodItemId: food.id, name, grams }, { onSuccess: () => setGrams(0) })}
            className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50"
          >
            Ölçüyü kaydet
          </button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-rose-700">
            {errorMessage(error, "Ölçü kaydedilemedi.")}
          </p>
        )}
      </div>
    </Modal>
  );
}
