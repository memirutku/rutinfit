"use client";

import { useEffect, useRef, useState } from "react";
import { Pill, Trash2 } from "lucide-react";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { errorMessage } from "@/lib/client/api";
import { useDeleteSupplement, useSaveSupplement, useSupplements } from "@/lib/client/queries/supplements";
import { getLocalDateString } from "@/lib/date-utils";
import { formatNumberTr } from "@/lib/format";
import { SUPPLEMENT_UNITS } from "@/lib/schemas/supplement";

const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";
const LABEL = "block text-xs font-semibold text-slate-600 mb-1";

type Unit = (typeof SUPPLEMENT_UNITS)[number];
const EMPTY_FORM = { name: "", doseAmount: 0, doseUnit: "g" as Unit, notes: "", caloriesPerDose: 0, proteinPerDose: 0 };

/** Boş ya da 0 → null (takviye günlüğe yazılmaz). */
const optional = (v: number) => (v > 0 ? v : null);

/**
 * F15: Takviye listesini yönet (ekle, düzenle, pasifleştir, sil). Geçmiş kayıtlar silinmez.
 * B12: doz başına kalori ve protein girilirse "alındı" işareti günlüğe öğün yazar.
 */
export function SupplementsSection() {
  const supplements = useSupplements(getLocalDateString());
  const save = useSaveSupplement();
  const remove = useDeleteSupplement();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const error = save.error ?? remove.error;
  // B12: panodaki "+ Takviye / Düzenle" bağlantısı (#takviyeler) liste yüklenince bölüme kaydırır.
  const sectionRef = useRef<HTMLElement>(null);
  const loaded = supplements.isSuccess;
  useEffect(() => {
    if (loaded && window.location.hash === "#takviyeler") sectionRef.current?.scrollIntoView?.({ block: "start" });
  }, [loaded]);

  function submit() {
    const input = {
      name: form.name.trim(),
      doseAmount: form.doseAmount,
      doseUnit: form.doseUnit,
      notes: form.notes.trim() || null,
      caloriesPerDose: optional(form.caloriesPerDose),
      proteinPerDose: optional(form.proteinPerDose),
    };
    save.mutate(
      { id: editingId ?? undefined, input },
      {
        onSuccess: () => {
          setForm({ ...EMPTY_FORM, doseUnit: form.doseUnit });
          setEditingId(null);
        },
      },
    );
  }

  return (
    <section ref={sectionRef} id="takviyeler" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 scroll-mt-16">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Pill className="w-5 h-5 text-emerald-600" />
        <h3 className="font-bold text-slate-900 text-base">Takviyeler</h3>
      </div>

      <ul className="divide-y divide-slate-100 text-sm">
        {supplements.data?.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 py-2">
            <span className="min-w-0">
              <span className={`font-semibold ${s.active ? "text-slate-800" : "text-slate-400"}`}>{s.name}</span>
              <span className="text-slate-500">
                {" "}
                · {formatNumberTr(s.doseAmount)} {s.doseUnit}
              </span>
              {s.notes && <span className="text-slate-500"> · {s.notes}</span>}
              {(s.caloriesPerDose || s.proteinPerDose) && (
                <span className="text-emerald-700">
                  {" "}
                  · {formatNumberTr(s.caloriesPerDose ?? 0)} kcal · {formatNumberTr(s.proteinPerDose ?? 0)} g protein günlüğe yazılır
                </span>
              )}
              {!s.active && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold">pasif</span>}
            </span>
            <span className="shrink-0 flex items-center gap-1">
              <button
                type="button"
                aria-label={`${s.name} düzenle`}
                onClick={() => {
                  setEditingId(s.id);
                  setForm({
                    name: s.name,
                    doseAmount: s.doseAmount,
                    doseUnit: (SUPPLEMENT_UNITS as readonly string[]).includes(s.doseUnit) ? (s.doseUnit as Unit) : "g",
                    notes: s.notes ?? "",
                    caloriesPerDose: s.caloriesPerDose ?? 0,
                    proteinPerDose: s.proteinPerDose ?? 0,
                  });
                }}
                className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                Düzenle
              </button>
              <button
                type="button"
                aria-label={`${s.name} ${s.active ? "pasifleştir" : "etkinleştir"}`}
                onClick={() => save.mutate({ id: s.id, input: { active: !s.active } })}
                className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                {s.active ? "Pasifleştir" : "Etkinleştir"}
              </button>
              <button type="button" aria-label={`${s.name} sil`} onClick={() => remove.mutate(s.id)} className="p-1 text-slate-400 hover:text-rose-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </span>
          </li>
        ))}
        {supplements.data?.length === 0 && <li className="py-2 text-slate-500">Listede takviye yok.</li>}
      </ul>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
        <div className="col-span-2">
          <label htmlFor="supp-name" className={LABEL}>
            Takviye adı
          </label>
          <input id="supp-name" value={form.name} placeholder="Örn: Omega 3" onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT} />
        </div>
        <div>
          <label htmlFor="supp-dose" className={LABEL}>
            Doz
          </label>
          <DecimalInput id="supp-dose" value={form.doseAmount} onValueChange={(v) => setForm({ ...form, doseAmount: v })} className={INPUT} />
        </div>
        <div>
          <label htmlFor="supp-unit" className={LABEL}>
            Birim
          </label>
          <select id="supp-unit" value={form.doseUnit} onChange={(e) => setForm({ ...form, doseUnit: e.target.value as typeof form.doseUnit })} className={INPUT}>
            {SUPPLEMENT_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="supp-notes" className={LABEL}>
            Not
          </label>
          <input id="supp-notes" value={form.notes} placeholder="Kahvaltıyla" onChange={(e) => setForm({ ...form, notes: e.target.value })} className={INPUT} />
        </div>
        <div>
          <label htmlFor="supp-kcal" className={LABEL}>
            Kalori (doz başına)
          </label>
          <DecimalInput
            id="supp-kcal"
            placeholder="İsteğe bağlı"
            value={form.caloriesPerDose || null}
            onValueChange={(v) => setForm({ ...form, caloriesPerDose: Math.max(0, v) })}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="supp-protein" className={LABEL}>
            Protein (g, doz başına)
          </label>
          <DecimalInput
            id="supp-protein"
            placeholder="İsteğe bağlı"
            value={form.proteinPerDose || null}
            onValueChange={(v) => setForm({ ...form, proteinPerDose: Math.max(0, v) })}
            className={INPUT}
          />
        </div>
        <div className="col-span-2 sm:col-span-2 flex gap-2">
          <button
            type="button"
            disabled={!form.name.trim() || !(form.doseAmount > 0) || save.isPending}
            onClick={submit}
            className="flex-1 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50"
          >
            {editingId ? "Değişiklikleri kaydet" : "Takviye ekle"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
            >
              Vazgeç
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        Whey gibi besin değeri olan takviyede doz başına kalori ve proteini gir: panoda &quot;alındı&quot; işaretleyince günlüğe öğün olarak
        yazılır, işareti kaldırınca silinir.
      </p>
      {error && (
        <p role="alert" className="text-xs text-rose-700">
          {errorMessage(error, "İşlem yapılamadı.")}
        </p>
      )}
      <p className="text-[11px] text-slate-500">Takviye bilgisi tıbbi öneri değildir; doz ve etkileşim için hekimine ya da eczacına danış.</p>
    </section>
  );
}
