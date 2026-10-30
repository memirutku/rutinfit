"use client";

import { useState } from "react";
import { Wrench } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { errorMessage } from "@/lib/client/api";
import { useApplyProgram, usePrograms, useStrengthExercises, type ProgramSummary } from "@/lib/client/queries/workouts";
import { formatDecimalTr } from "@/lib/format";
import { trainingMaxFrom1Rm } from "@/lib/programs";
import { normalizeName } from "@/lib/text";
import { DAYS_OF_WEEK } from "./WeeklyPlanGrid";

const dayName = (d: number) => DAYS_OF_WEEK.find((x) => x.day === d)?.name ?? String(d);

const LEVEL_TONE: Record<string, string> = {
  Başlangıç: "bg-emerald-50 text-emerald-700",
  Orta: "bg-amber-50 text-amber-800",
  İleri: "bg-indigo-50 text-indigo-700",
};

interface ProgramPickerProps {
  open: boolean;
  onClose: () => void;
  /** B21: "kendi programını kur" — boş şablon editörünü açar. */
  onBuildOwn?: () => void;
}

/** F18: Hazır programı haftalık plana ekler ya da planın yerine kullanır (iki adımlı onay). */
export function ProgramPicker({ open, onClose, onBuildOwn }: ProgramPickerProps) {
  const programs = usePrograms({ enabled: open });
  const apply = useApplyProgram();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // B21: %1RM programlarında kaldırış başına girilen 1RM (kg)
  const [oneRepMaxes, setOneRepMaxes] = useState<Record<string, number>>({});
  const needs1Rm = !!programs.data?.some((p) => (p.oneRepMaxLifts ?? []).length > 0);
  const strength = useStrengthExercises({ enabled: open && needs1Rm });
  const e1rmOf = (lift: string) => strength.data?.exercises.find((e) => normalizeName(e.name) === normalizeName(lift))?.bestE1rm ?? null;

  const run = (p: ProgramSummary, mode: "replace" | "add") => {
    const lifts = p.oneRepMaxLifts ?? [];
    const entered = Object.fromEntries(lifts.filter((l) => oneRepMaxes[l] > 0).map((l) => [l, oneRepMaxes[l]]));
    apply.mutate(
      { programId: p.id, mode, ...(lifts.length ? { oneRepMaxes: entered } : {}) },
      { onSuccess: () => (setConfirmId(null), onClose()) }
    );
  };

  return (
    <Modal focusFirstField={false}
      open={open}
      onClose={onClose}
      title="Hazır programlar"
      description="Başlangıçtan ileri seviyeye programlar. Sonra şablon editöründen değiştirebilirsin."
      widthClass="max-w-2xl"
    >
      <div className="space-y-3">
        {/* B21: kendi programını kurmak her zaman ilk seçenek olarak görünür. */}
        {onBuildOwn && (
          <div className="p-4 rounded-xl border border-brand-200 bg-brand-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Wrench className="w-4 h-4 text-brand-700 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-900">Aradığın program yok mu?</p>
                <p className="text-xs text-slate-600">
                  Kendi şablonunu kur: hareketleri, set ve tekrar aralığını, artış miktarını sen belirle. Strong/Hevy geçmişini openGym sayfasından
                  aktarabilir ya da antrenmanı "Metinden ekle" ile yazabilirsin.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onBuildOwn}
              className="shrink-0 px-3 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700"
            >
              Kendi programını kur
            </button>
          </div>
        )}
        {apply.isError && (
          <p role="alert" className="text-xs font-semibold text-rose-700">
            {errorMessage(apply.error, "Program uygulanamadı.")}
          </p>
        )}
        <ul className="space-y-3">
          {programs.data?.map((p) => {
            const lifts = p.oneRepMaxLifts ?? [];
            return (
              <li key={p.id} className="p-4 rounded-xl border border-slate-200 space-y-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{p.name}</h4>
                    {p.level && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${LEVEL_TONE[p.level] ?? "bg-slate-100 text-slate-700"}`}>
                        {p.level}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {p.place} · haftada {p.daysPerWeek} gün
                  </p>
                </div>
                <p className="text-xs text-slate-600">{p.description}</p>
                {p.days.length > 0 && (
                  <p className="text-[11px] text-slate-500">{p.days.map((d) => `${dayName(d.dayOfWeek)}: ${d.name}`).join(" · ")}</p>
                )}
                {lifts.length > 0 && (
                  <fieldset className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <legend className="text-[11px] font-bold text-slate-700 px-1">1RM (tek tekrar maksimumu)</legend>
                    <p className="text-[11px] text-slate-500">
                      Ağırlıklar antrenman maksimumundan (TM = 1RM'in %90'ı) hesaplanır. Boş bırakırsan kayıtlarındaki tahmini 1RM (e1RM)
                      kullanılır; o da yoksa ağırlığı seansta girersin.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {lifts.map((lift) => {
                        const e1rm = e1rmOf(lift);
                        const tm = trainingMaxFrom1Rm(oneRepMaxes[lift] > 0 ? oneRepMaxes[lift] : (e1rm ?? 0));
                        return (
                          <div key={lift}>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                              {lift}
                              <DecimalInput
                                aria-label={`${lift} 1RM (kg)`}
                                value={oneRepMaxes[lift] ?? null}
                                emptyValue={Number.NaN}
                                placeholder={e1rm ? `e1RM ${formatDecimalTr(e1rm)}` : "kg"}
                                onValueChange={(v) =>
                                  setOneRepMaxes((m) => {
                                    const next = { ...m };
                                    if (Number.isNaN(v) || v <= 0) delete next[lift];
                                    else next[lift] = v;
                                    return next;
                                  })
                                }
                                className="mt-0.5 w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                              />
                            </label>
                            <p className="text-[10px] text-slate-500">{tm ? `${lift}: TM ${formatDecimalTr(tm)} kg` : "TM: seansta"}</p>
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={apply.isPending}
                    onClick={() => run(p, "add")}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Plana ekle
                  </button>
                  {confirmId === p.id ? (
                    <button
                      type="button"
                      disabled={apply.isPending}
                      onClick={() => run(p, "replace")}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold disabled:opacity-50"
                    >
                      Mevcut şablonlar silinecek; onayla
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(p.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
                    >
                      Planın yerine kullan
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] text-slate-500">Planın yerine kullanmak geçmiş antrenmanlarını silmez; yalnız haftalık şablonları değiştirir.</p>
      </div>
    </Modal>
  );
}
