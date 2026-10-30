"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dumbbell, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStrengthDetail, useStrengthExercises } from "@/lib/client/queries/workouts";
import { VolumeSection } from "./VolumeSection";
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

/** B24: Antrenman sayfasındaki kısayolun hedefi (/progress#guc). */
export const STRENGTH_ANCHOR = "guc";

/** Sayfa #guc ile açıldıysa bölüm (veri geç yüklense de) görünür alana kaydırılır. */
function useScrollIntoViewOnHash(id: string) {
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== `#${id}`) return;
    document.getElementById(id)?.scrollIntoView?.({ block: "start" });
  }, [id]);
}

/**
 * B24: İlerleme sayfasındaki antrenman bölümleri. Antrenman kaydı yoksa güç ve set hacmi
 * yerine tek, sade bir boş durum; varsa iki bölüm birlikte.
 */
export function TrainingProgress() {
  const list = useStrengthExercises();
  useScrollIntoViewOnHash(STRENGTH_ANCHOR);
  if (list.isSuccess && list.data.exercises.length === 0) {
    return (
      <section id={STRENGTH_ANCHOR} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-brand-600" />
          <h3 className="font-bold text-slate-900 text-base">Güç gelişimi</h3>
        </div>
        <p className="text-sm text-slate-600">
          Henüz antrenman kaydın yok. İlk antrenmanını kaydettiğinde en iyi setlerin, kaldırdığın ağırlığın zamanla nasıl değiştiği ve
          her kas grubunun haftada kaç set çalıştığı burada görünür.
        </p>
        <Link
          href="/workouts"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
        >
          <Dumbbell className="w-3.5 h-3.5" />
          Antrenman&apos;a git
        </Link>
      </section>
    );
  }
  return (
    <>
      <StrengthSection />
      {/* Liste gelene kadar set hacmi istenmez: kayıt yoksa hiç gösterilmeyecek. */}
      {!list.isPending && <VolumeSection />}
    </>
  );
}

/** F23: Egzersiz başına rekorlar, tahmini tek tekrar trendi ve son seanslar. Tüm geçmiş yereldir. */
export function StrengthSection() {
  const list = useStrengthExercises();
  const exercises = list.data?.exercises ?? [];
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const selected = picked ?? exercises[0]?.name;
  const detail = useStrengthDetail(selected);
  const d = detail.data;
  const chart = (d?.history ?? []).map((h) => ({ date: formatDateTr(h.date, { short: true }), e1rm: h.e1rm }));

  return (
    <section id={STRENGTH_ANCHOR} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 scroll-mt-4">
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
                title="Tahmini en iyi tek tekrar"
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
            <div className="h-56" aria-label="Tahmini tek tekrar trendi">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} domain={["auto", "auto"]} tickFormatter={formatAxisTick} />
                  <Tooltip formatter={(v) => [formatKg(Number(v)), "Tahmini 1 tekrar"]} />
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
                <th scope="col" className="py-1.5">Tahmini 1 tekrar</th>
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
          <p className="text-[11px] text-slate-400">
            Tahmini tek tekrar (e1RM): yaptığın ağırlık ve tekrardan hesaplanan, bir kez kaldırabileceğin en fazla ağırlık (Epley formülü).
            10 tekrarın üstünde doğruluğu düşer. Hacim: ağırlık × tekrar toplamı.
          </p>
        </>
      )}
    </section>
  );
}
