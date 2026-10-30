"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStrengthDetail, useStrengthExercises } from "@/lib/client/queries/workouts";
import { formatDateTr, formatDecimalTr, formatKg } from "@/lib/format";

/** B23: grafik ekseni Türkçe ondalıkla (116.85 → "116,85"). */
export const formatAxisTick = (value: number) => formatDecimalTr(Number(value));

function RecordCard({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return (
    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
      <p className="text-[11px] font-bold text-slate-500 uppercase">{title}</p>
      <p className="text-lg font-extrabold text-slate-900">{value}</p>
      {detail && <p className="text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

/** F23: Egzersiz başına rekorlar, e1RM trendi ve son seanslar. Tüm geçmiş ücretsiz ve yereldir. */
export function StrengthSection() {
  const list = useStrengthExercises();
  const exercises = list.data?.exercises ?? [];
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const selected = picked ?? exercises[0]?.name;
  const detail = useStrengthDetail(selected);
  const d = detail.data;
  const chart = (d?.history ?? []).map((h) => ({ date: formatDateTr(h.date, { short: true }), e1rm: h.e1rm }));

  return (
    <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-brand-600" />
          <h3 className="font-bold text-slate-900 text-base">Güç gelişimi</h3>
        </div>
        {exercises.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="strength-exercise" className="text-xs font-semibold text-slate-600">
              Egzersiz
            </label>
            <select
              id="strength-exercise"
              value={selected}
              onChange={(e) => setPicked(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            >
              {exercises.map((e) => (
                <option key={e.name} value={e.name}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {list.isSuccess && exercises.length === 0 && (
        <p className="text-sm text-slate-500">Henüz tamamlanmış antrenman yok. İlk seansından sonra rekorların burada görünür.</p>
      )}

      {d && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {d.prs.bestE1rm ? (
              <RecordCard
                title="En iyi e1RM"
                value={formatKg(d.prs.bestE1rm.value)}
                detail={`${formatKg(d.prs.bestE1rm.weightKg)} × ${d.prs.bestE1rm.reps} · ${formatDateTr(d.prs.bestE1rm.date)}`}
              />
            ) : (
              d.prs.mostReps && (
                <RecordCard title="En çok tekrar" value={`${d.prs.mostReps.reps} tekrar`} detail={formatDateTr(d.prs.mostReps.date)} />
              )
            )}
            {d.prs.heaviest && (
              <RecordCard
                title="En ağır set"
                value={`${formatKg(d.prs.heaviest.weightKg)} × ${d.prs.heaviest.reps}`}
                detail={formatDateTr(d.prs.heaviest.date)}
              />
            )}
            {d.prs.bestVolume && (
              <RecordCard title="En yüksek hacim" value={formatKg(d.prs.bestVolume.volumeKg)} detail={formatDateTr(d.prs.bestVolume.date)} />
            )}
          </div>

          {d.plateau && (
            <p role="note" className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              {d.plateau.message}
            </p>
          )}

          {chart.length > 1 && (
            <div className="h-56" aria-label="e1RM trendi">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} domain={["auto", "auto"]} tickFormatter={formatAxisTick} />
                  <Tooltip formatter={(v) => [formatKg(Number(v)), "e1RM"]} />
                  <Line type="monotone" dataKey="e1rm" stroke="#0f766e" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <table className="w-full text-xs">
            <caption className="sr-only">Son seanslar</caption>
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th scope="col" className="py-1.5">Tarih</th>
                <th scope="col" className="py-1.5">En iyi set</th>
                <th scope="col" className="py-1.5">e1RM</th>
                <th scope="col" className="py-1.5">Hacim</th>
              </tr>
            </thead>
            <tbody>
              {[...d.history]
                .reverse()
                .slice(0, 5)
                .map((h) => (
                  <tr key={h.date} className="border-b border-slate-100">
                    <td className="py-1.5">{formatDateTr(h.date)}</td>
                    <td className="py-1.5">
                      {formatKg(h.topSet.weightKg)} × {h.topSet.reps}
                    </td>
                    <td className="py-1.5">{h.e1rm ? formatKg(h.e1rm) : "—"}</td>
                    <td className="py-1.5">{formatKg(h.volumeKg)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-400">e1RM: tahmini tek tekrar maksimumu (Epley formülü). 10 tekrarın üstünde doğruluğu düşer.</p>
        </>
      )}
    </section>
  );
}
