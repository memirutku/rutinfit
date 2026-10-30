"use client";

import { BarChart3 } from "lucide-react";
import { useWeeklyVolume } from "@/lib/client/queries/workouts";
import { formatDateTr } from "@/lib/format";
import { volumeStatus, type VolumeStatus } from "@/lib/muscle-volume";

const STATUS: Record<VolumeStatus, { label: string; tone: string }> = {
  low: { label: "Az", tone: "bg-amber-100 text-amber-800" },
  ok: { label: "Hedefte", tone: "bg-emerald-100 text-emerald-800" },
  high: { label: "Fazla", tone: "bg-rose-100 text-rose-800" },
};

/** F24: Kas grubu başına haftalık set sayısı ve hedef aralığı. */
export function VolumeSection({ weeks = 4 }: { weeks?: number }) {
  const { data } = useWeeklyVolume(weeks);
  if (!data) return null;
  const trained = data.rows.filter((r) => r.sets.some((n) => n > 0));
  const untrained = data.rows.filter((r) => r.sets.every((n) => n === 0));
  const last = data.weeks.length - 1;

  return (
    <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-brand-600" />
          <h3 className="font-bold text-slate-900 text-base">Haftalık set hacmi</h3>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Kas grubu başına haftalık set. Kas gelişimi için yaygın hedef aralığı haftada {data.target.min}–{data.target.max} set. Bir
          set, çalıştırdığı her kas grubuna sayılır.
        </p>
      </div>

      {trained.length === 0 ? (
        <p className="text-sm text-slate-500">Bu dönemde tamamlanmış antrenman yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">Kas grubu başına haftalık set</caption>
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th scope="col" className="py-1.5 pr-2">Kas grubu</th>
                {data.weeks.map((w) => (
                  <th key={w} scope="col" className="py-1.5 px-1 text-right">
                    {formatDateTr(w, { short: true })}
                  </th>
                ))}
                <th scope="col" className="py-1.5 pl-2">Bu hafta</th>
              </tr>
            </thead>
            <tbody>
              {trained.map((r) => {
                const status = STATUS[volumeStatus(r.sets[last])];
                return (
                  <tr key={r.muscleId} className="border-b border-slate-100">
                    <th scope="row" className="py-1.5 pr-2 text-left font-semibold text-slate-800">
                      {r.nameTr}
                    </th>
                    {r.sets.map((n, i) => (
                      <td key={data.weeks[i]} className={`py-1.5 px-1 text-right ${i === last ? "font-bold text-slate-900" : "text-slate-500"}`}>
                        {n}
                      </td>
                    ))}
                    <td className="py-1.5 pl-2">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${status.tone}`}>{status.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {untrained.length > 0 && trained.length > 0 && (
        <p className="text-[11px] text-slate-500">Bu dönemde çalışılmayan: {untrained.map((r) => r.nameTr).join(", ")}</p>
      )}
    </section>
  );
}
