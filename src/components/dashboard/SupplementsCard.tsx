"use client";

import Link from "next/link";
import { CheckCircle2, Circle, Pill } from "lucide-react";
import { errorMessage } from "@/lib/client/api";
import { useLogSupplement, useSupplements } from "@/lib/client/queries/supplements";
import { formatNumberTr } from "@/lib/format";

/** F15: Günün takviyeleri. Her takviye tek tıkla alındı/alınmadı işaretlenir. */
export function SupplementsCard({ date }: { date: string }) {
  const supplements = useSupplements(date);
  const log = useLogSupplement();
  const active = supplements.data?.filter((s) => s.active) ?? [];

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Takviyeler</span>
        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <Pill className="w-4 h-4" />
        </div>
      </div>
      {supplements.isSuccess && active.length === 0 && (
        <p className="text-xs text-slate-500">
          Takviye listen boş.{" "}
          <Link href="/settings" className="font-semibold text-brand-700 hover:underline">
            Ayarlar&apos;dan takviye ekleyebilirsin.
          </Link>
        </p>
      )}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {active.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              aria-pressed={s.takenToday}
              disabled={log.isPending}
              onClick={() => log.mutate({ supplementId: s.id, date, taken: !s.takenToday })}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                s.takenToday ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
            >
              {s.takenToday ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <Circle className="w-4 h-4 shrink-0 text-slate-400" />}
              <span className="min-w-0">
                <span className="block text-xs font-bold truncate">{s.name}</span>
                <span className="block text-[11px] text-slate-500">
                  {formatNumberTr(s.doseAmount)} {s.doseUnit} · {s.takenLast7}/7 gün
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {log.isError && (
        <p role="alert" className="text-xs text-rose-700">
          {errorMessage(log.error, "Takviye kaydı güncellenemedi.")}
        </p>
      )}
    </div>
  );
}
