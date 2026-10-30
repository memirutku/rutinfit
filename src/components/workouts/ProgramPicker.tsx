"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { errorMessage } from "@/lib/client/api";
import { useApplyProgram, usePrograms } from "@/lib/client/queries/workouts";
import { DAYS_OF_WEEK } from "./WeeklyPlanGrid";

const dayName = (d: number) => DAYS_OF_WEEK.find((x) => x.day === d)?.name ?? String(d);

/** F18: Hazır programı haftalık plana ekler ya da planın yerine kullanır (iki adımlı onay). */
export function ProgramPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const programs = usePrograms({ enabled: open });
  const apply = useApplyProgram();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const run = (programId: string, mode: "replace" | "add") =>
    apply.mutate({ programId, mode }, { onSuccess: () => (setConfirmId(null), onClose()) });

  return (
    <Modal open={open} onClose={onClose} title="Hazır programlar" description="Başlangıç ve ev programları. Sonra şablon editöründen değiştirebilirsin." widthClass="max-w-2xl">
      <div className="space-y-3">
        {apply.isError && (
          <p role="alert" className="text-xs font-semibold text-rose-700">
            {errorMessage(apply.error, "Program uygulanamadı.")}
          </p>
        )}
        <ul className="space-y-3">
          {programs.data?.map((p) => (
            <li key={p.id} className="p-4 rounded-xl border border-slate-200 space-y-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900">{p.name}</h4>
                <p className="text-xs text-slate-500">
                  {p.place} · haftada {p.daysPerWeek} gün
                </p>
              </div>
              <p className="text-xs text-slate-600">{p.description}</p>
              {p.days.length > 0 && (
                <p className="text-[11px] text-slate-500">{p.days.map((d) => `${dayName(d.dayOfWeek)}: ${d.name}`).join(" · ")}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={apply.isPending}
                  onClick={() => run(p.id, "add")}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Plana ekle
                </button>
                {confirmId === p.id ? (
                  <button
                    type="button"
                    disabled={apply.isPending}
                    onClick={() => run(p.id, "replace")}
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
          ))}
        </ul>
        <p className="text-[11px] text-slate-500">Planın yerine kullanmak geçmiş antrenmanlarını silmez; yalnız haftalık şablonları değiştirir.</p>
      </div>
    </Modal>
  );
}
