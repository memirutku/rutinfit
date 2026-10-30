"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartPulse } from "lucide-react";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { queryKeys } from "@/lib/client/queries/keys";
import { readAppleHealthExport, type SourceBreakdown } from "@/lib/apple-health";
import { formatDateTr, formatNumberTr } from "@/lib/format";
import { FilePicker } from "@/components/ui/FilePicker";
import type { healthSummary } from "@/lib/services/health-import";

type Summary = Awaited<ReturnType<typeof healthSummary>>;
const KEY = [...queryKeys.progress, "apple-health"];
const BATCH = 5000;
const METRIC_LABEL = { steps: "Adım", active_kcal: "Aktif enerji" } as const;

/** B37: çift sayım önleminin tek satırlık açıklaması (ölçü başına). */
export function dedupLines(b: SourceBreakdown): string[] {
  const lines: string[] = [];
  for (const m of b.metrics) {
    if (m.days === 0) continue;
    const label = METRIC_LABEL[m.type];
    if (m.overlapDays > 0 && m.overlapWinner) {
      const mostly = m.overlapWinnerDays > 0 && m.overlapWinnerDays < m.overlapDays ? "çoğunlukla " : "";
      lines.push(`${label}: ${formatNumberTr(m.overlapDays)} günde birden çok kaynak vardı; aynı gün için yalnız yüksek kaynak alındı (${mostly}${m.overlapWinner}).`);
    } else if (m.sources.length === 1) {
      lines.push(`${label}: tek kaynak (${m.sources[0].source}); birleştirme gerekmedi.`);
    } else {
      lines.push(`${label}: ${formatNumberTr(m.sources.length)} kaynak farklı günlerde veri verdi; çakışan gün yok.`);
    }
  }
  if (b.duplicateWorkouts > 0) lines.push(`Aynı antrenmanın ${formatNumberTr(b.duplicateWorkouts)} kopyası (başka uygulamadan) bir kez sayıldı.`);
  return lines;
}

function DedupSummary({ breakdown }: { breakdown: SourceBreakdown }) {
  const lines = dedupLines(breakdown);
  const rows = breakdown.metrics.flatMap((m) => m.sources.map((s) => ({ metric: METRIC_LABEL[m.type], ...s })));
  if (!lines.length) return null;
  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5">
      <p className="font-bold text-slate-800">Çift sayım önlemi</p>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {rows.length > 0 && (
        <details className="pt-1">
          <summary className="cursor-pointer font-semibold text-slate-700">Kaynak dökümü</summary>
          <table className="mt-2 w-full text-left text-[11px]">
            <caption className="sr-only">Kaynak başına gün sayıları</caption>
            <thead>
              <tr className="text-slate-500 border-b border-slate-200">
                <th scope="col" className="py-1 pr-2 font-semibold">Ölçü</th>
                <th scope="col" className="py-1 pr-2 font-semibold">Kaynak</th>
                <th scope="col" className="py-1 pr-2 font-semibold">Veri olan gün</th>
                <th scope="col" className="py-1 font-semibold">Alınan gün</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.metric}-${r.source}`} className="border-b border-slate-100 align-top">
                  <td className="py-1 pr-2">{r.metric}</td>
                  <td className="py-1 pr-2 break-words">{r.source}</td>
                  <td className="py-1 pr-2 whitespace-nowrap">{`${formatNumberTr(r.days)} gün`}</td>
                  <td className="py-1 whitespace-nowrap">{`${formatNumberTr(r.chosenDays)} gün`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-slate-500">Aynı gün için telefon ve saat aynı adımları ayrı ayrı sayar; toplamı yüksek olan tek kaynak alınır, ikisi toplanmaz.</p>
        </details>
      )}
    </div>
  );
}

/**
 * F62: Apple Sağlık içe aktarma. Dosya tarayıcıda akışla okunur; sunucuya yalnız günlük özetler
 * gider. Veriler salt okunurdur ve kendi kayıtlarına eklenmez (çift sayım olmaz).
 */
export function AppleHealthSection() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: KEY, queryFn: () => apiFetch<Summary>("/api/apple-health") });
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<SourceBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Recheck (Can): veri kaldırılınca seçili dosya adı da temizlenir.
  const [pickedName, setPickedName] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: () => apiFetch("/api/apple-health", { method: "DELETE" }),
    onSuccess: () => {
      setConfirmDelete(false);
      setResult(null);
      setBreakdown(null);
      setPickedName(null);
      return qc.invalidateQueries({ queryKey: KEY });
    },
  });

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    setBreakdown(null);
    setProgress(0);
    try {
      const { records, breakdown: sources } = await readAppleHealthExport(file, (read, total) => setProgress(total ? Math.round((read / total) * 100) : 0));
      let created = 0;
      let updated = 0;
      for (let i = 0; i < records.length; i += BATCH) {
        const res = await apiFetch<{ created: number; updated: number }>("/api/apple-health/import", { method: "POST", json: { records: records.slice(i, i + BATCH) } });
        created += res.created;
        updated += res.updated;
      }
      setResult(`${formatNumberTr(records.length)} kayıt içe aktarıldı (${formatNumberTr(created)} yeni, ${formatNumberTr(updated)} güncellendi).`);
      setBreakdown(sources ?? null);
      await qc.invalidateQueries({ queryKey: KEY });
    } catch (e) {
      setError(errorMessage(e, "Dosya okunamadı."));
    } finally {
      setProgress(null);
    }
  }

  return (
    <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <HeartPulse className="w-5 h-5 text-rose-600" />
        <h3 className="font-bold text-slate-900 text-base">Apple Sağlık</h3>
      </div>
      <p className="text-xs text-slate-500">
        iPhone&apos;da Sağlık › profil resmi › <em>Tüm sağlık verilerini dışa aktar</em> ile oluşan export.zip&apos;i seç. Dosya bu
        bilgisayarda okunur; yalnız günlük adım, aktif enerji, dinlenik nabız, kilo ve antrenman özetleri kaydedilir. Bu kayıtlar
        kendi kilo ve kardiyo kayıtlarına eklenmez; aynı tartı ya da antrenman iki kez sayılmaz.
      </p>

      <FilePicker
        id="apple-health-file"
        label="Apple Sağlık dışa aktarımı (export.zip)"
        accept=".zip,.xml,application/zip,text/xml"
        disabled={progress !== null}
        fileName={pickedName}
        onFile={(file) => {
          setPickedName(file?.name ?? null);
          void onFile(file);
        }}
      />
      {progress !== null && (
        <div role="progressbar" aria-label="Okunuyor" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div className="h-full bg-rose-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {result && (
        <div className="space-y-1">
          <p role="status" className="text-xs font-semibold text-emerald-700">
            {result}
          </p>
          <p className="text-[11px] text-slate-500">Her kayıt bir günün tek özetidir: o günün adım toplamı, aktif enerjisi, dinlenik nabzı, kilosu ya da bir antrenman.</p>
        </div>
      )}
      {breakdown && <DedupSummary breakdown={breakdown} />}
      {error && (
        <p role="alert" className="text-xs text-rose-700">
          {error}
        </p>
      )}

      {data && data.total === 0 && <p className="text-sm text-slate-500">Henüz Apple Sağlık verisi yok.</p>}
      {data && data.total > 0 && (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div className="p-3 rounded-xl bg-slate-50">
              <dt className="text-[11px] text-slate-500">Adım (7 gün ort.)</dt>
              <dd className="text-lg font-extrabold text-slate-900">{data.steps.avg7 !== null ? formatNumberTr(data.steps.avg7) : "—"}</dd>
            </div>
            <div className="p-3 rounded-xl bg-slate-50">
              <dt className="text-[11px] text-slate-500">Aktif enerji (7 gün ort.)</dt>
              <dd className="text-lg font-extrabold text-slate-900">{data.activeKcal.avg7 !== null ? `${formatNumberTr(data.activeKcal.avg7)} kcal` : "—"}</dd>
            </div>
            <div className="p-3 rounded-xl bg-slate-50">
              <dt className="text-[11px] text-slate-500">Dinlenik nabız</dt>
              <dd className="text-lg font-extrabold text-slate-900">{data.restingHr.latest ? `${formatNumberTr(data.restingHr.latest.value)} atım/dk` : "—"}</dd>
            </div>
            <div className="p-3 rounded-xl bg-slate-50">
              <dt className="text-[11px] text-slate-500">Kilo (Sağlık)</dt>
              <dd className="text-lg font-extrabold text-slate-900">{data.weight.latest ? `${formatNumberTr(data.weight.latest.value)} kg` : "—"}</dd>
              {data.weight.ownLatest && (
                <dd className="text-[11px] text-slate-500">
                  kendi kaydın: {formatNumberTr(data.weight.ownLatest.value)} kg ({formatDateTr(data.weight.ownLatest.date, { short: true })})
                </dd>
              )}
            </div>
          </dl>
          {data.workouts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">Son antrenmanlar (Sağlık)</p>
              <ul className="text-xs text-slate-700 space-y-0.5">
                {data.workouts.map((w) => (
                  <li key={w.id}>
                    {formatDateTr(w.date, { short: true })} · {w.detail?.activity ?? "Antrenman"}
                    {w.detail && ` · ${formatNumberTr(w.detail.durationMin)} dk`}
                    {w.detail?.distanceKm ? ` · ${formatNumberTr(w.detail.distanceKm)} km` : ""}
                    {w.detail?.kcal ? ` · ${formatNumberTr(w.detail.kcal)} kcal` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>
              {formatNumberTr(data.total)} kayıt{data.lastImportedAt && ` · son içe aktarma ${formatDateTr(data.lastImportedAt.slice(0, 10))}`}
            </span>
            {confirmDelete ? (
              <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="px-2 py-1 rounded-lg bg-rose-600 text-white font-bold">
                Kaldırmayı onayla
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="px-2 py-1 rounded-lg text-rose-700 font-bold hover:bg-rose-50">
                Apple Sağlık verilerini kaldır
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
