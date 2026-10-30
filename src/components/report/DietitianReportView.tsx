"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Printer } from "lucide-react";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { downloadFile } from "@/lib/client/download";
import { addDaysToDateString, getLocalDateString } from "@/lib/date-utils";
import { formatDateTr, formatNumberTr } from "@/lib/format";
import type { DietitianReport } from "@/lib/services/dietitian-report";

const n = (v: number | null | undefined, unit = "") => (v === null || v === undefined ? "—" : `${formatNumberTr(v)}${unit}`);
const GOAL_TR: Record<string, string> = { lose: "Kilo vermek", maintain: "Kilo korumak", gain: "Kilo almak" };
const TH = "px-2 py-1.5 text-left font-semibold text-slate-600 border-b border-slate-200";
const TD = "px-2 py-1 border-b border-slate-100";

/** F77: Diyetisyene rapor. Yazdır › PDF olarak kaydet ya da Excel indir. */
export function DietitianReportView({ today = getLocalDateString() }: { today?: string }) {
  const [range, setRange] = useState({ from: addDaysToDateString(today, -6), to: today });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const report = useQuery({
    queryKey: ["reports", "dietitian", range.from, range.to],
    queryFn: () => apiFetch<DietitianReport>(`/api/reports/dietitian?from=${range.from}&to=${range.to}`),
    // Aralık değişirken eski rapor ekranda kalır (titreme yok); düğmeler yeni veri gelene dek kapalı.
    placeholderData: (prev) => prev,
  });
  const r = report.data;
  const ready = !!r && !report.isPlaceholderData;
  const preset = (days: number) => setRange({ from: addDaysToDateString(today, -(days - 1)), to: today });

  async function print() {
    setError(null);
    try {
      // Masaüstü uygulamasında Tauri bunu sistemin yazdırma penceresine bağlar (PDF olarak kaydet dahil).
      await Promise.resolve(window.print());
    } catch {
      setError("Yazdırma penceresi açılamadı. Excel olarak indirip oradan yazdırabilirsin.");
    }
  }

  async function excel() {
    setError(null);
    try {
      const { name, savedPath } = await downloadFile(`/api/reports/dietitian/xlsx?from=${range.from}&to=${range.to}`, "rutinfit-diyetisyen-raporu.xlsx", "X-RutinFit-Export-Path");
      setMessage(`Excel indirildi: ${name}.` + (savedPath ? ` Bir kopyası uygulama klasörüne kaydedildi: ${savedPath}` : ""));
    } catch (e) {
      setError(errorMessage(e, "Excel hazırlanamadı."));
    }
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="print:hidden flex flex-wrap items-end gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex gap-1">
          <button type="button" onClick={() => preset(7)} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold">
            Son 7 gün
          </button>
          <button type="button" onClick={() => preset(30)} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold">
            Son 30 gün
          </button>
        </div>
        <div>
          <label htmlFor="rep-from" className="block text-xs font-semibold text-slate-600 mb-1">
            Başlangıç
          </label>
          <input id="rep-from" type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
        </div>
        <div>
          <label htmlFor="rep-to" className="block text-xs font-semibold text-slate-600 mb-1">
            Bitiş
          </label>
          <input id="rep-to" type="date" value={range.to} max={today} onChange={(e) => setRange({ ...range, to: e.target.value })} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
        </div>
        <div className="flex gap-2 ml-auto">
          <button type="button" onClick={print} disabled={!ready} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50">
            <Printer className="w-4 h-4" aria-hidden />
            Yazdır / PDF
          </button>
          <button type="button" onClick={excel} disabled={!ready} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold disabled:opacity-50">
            <FileSpreadsheet className="w-4 h-4" aria-hidden />
            Excel indir
          </button>
        </div>
        {message && <p role="status" className="w-full text-xs text-emerald-700">{message}</p>}
        {(error || report.isError) && (
          <p role="alert" className="w-full text-xs text-rose-700">
            {error ?? errorMessage(report.error, "Rapor hazırlanamadı.")}
          </p>
        )}
      </div>

      {r && (
        <article className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:border-0 print:shadow-none print:p-0 space-y-5 text-sm">
          <header className="border-b border-slate-200 pb-3">
            <h1 className="text-xl font-extrabold text-slate-900">Beslenme ve aktivite raporu</h1>
            <p className="text-slate-600">
              {formatDateTr(r.from)} – {formatDateTr(r.to)} · {r.dayCount} gün · RutinFit
            </p>
          </header>

          {r.profile && (
            <section aria-label="Kişi ve hedefler" className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
              <p>Yaş: <strong>{r.profile.age}</strong></p>
              <p>Cinsiyet: <strong>{r.profile.sex === "female" ? "Kadın" : "Erkek"}</strong></p>
              <p>Boy: <strong>{n(r.profile.heightCm, " cm")}</strong></p>
              <p>Hedef: <strong>{GOAL_TR[r.profile.goalType] ?? r.profile.goalType}</strong></p>
              <p>Kalori hedefi: <strong>{n(r.profile.calorieTarget, " kcal")}</strong></p>
              <p>Protein: <strong>{n(r.profile.proteinTargetG, " g")}</strong></p>
              <p>Karbonhidrat: <strong>{n(r.profile.carbTargetG, " g")}</strong></p>
              <p>Yağ: <strong>{n(r.profile.fatTargetG, " g")}</strong></p>
              {r.profile.notes && <p className="col-span-2 sm:col-span-4">Notlar: <strong>{r.profile.notes}</strong></p>}
            </section>
          )}

          <section aria-label="Özet" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ["Kayıtlı gün", `${r.loggedDays} / ${r.dayCount}`],
              ["Hedef aralığında", `${r.daysOnTarget} gün`],
              ["Ort. kalori", n(r.averages.kcal, " kcal")],
              ["Ort. protein", n(r.averages.protein, " g")],
              ["Ort. karbonhidrat", n(r.averages.carbs, " g")],
              ["Ort. yağ", n(r.averages.fat, " g")],
              ["Kilo değişimi", r.weight ? `${n(r.weight.start)} → ${n(r.weight.end)} kg (${r.weight.change > 0 ? "+" : ""}${formatNumberTr(r.weight.change)})` : "—"],
              ["Antrenman / kardiyo", `${r.training.sessions} seans · ${n(r.training.cardioMin, " dk")}`],
            ].map(([label, value]) => (
              <div key={label} className="p-2 rounded-lg bg-slate-50 print:bg-white print:border print:border-slate-200">
                <p className="text-[11px] text-slate-500">{label}</p>
                <p className="font-bold text-slate-900">{value}</p>
              </div>
            ))}
          </section>

          <section aria-label="Günlük tablo" className="overflow-x-auto">
            <h2 className="font-bold text-slate-900 mb-1">Günlük</h2>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {["Tarih", "Kalori", "Protein", "Karb.", "Yağ", "Sıvı", "Kilo", "Antr.", "Kardiyo"].map((h) => (
                    <th key={h} scope="col" className={TH}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.days.map((d) => (
                  <tr key={d.date} className={d.onTarget === false ? "bg-amber-50/60 print:bg-white" : ""}>
                    <td className={TD}>{formatDateTr(d.date, { short: true })}</td>
                    <td className={TD}>{n(d.kcal)}</td>
                    <td className={TD}>{n(d.protein, " g")}</td>
                    <td className={TD}>{n(d.carbs, " g")}</td>
                    <td className={TD}>{n(d.fat, " g")}</td>
                    <td className={TD}>{n(d.waterMl, " ml")}</td>
                    <td className={TD}>{n(d.weightKg, " kg")}</td>
                    <td className={TD}>{d.workouts || "—"}</td>
                    <td className={TD}>{d.cardioMin ? `${d.cardioMin} dk` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {r.meals.length > 0 && (
            <section aria-label="Öğün günlüğü" className="space-y-2 print:break-before-page">
              <h2 className="font-bold text-slate-900">Öğün günlüğü</h2>
              {r.meals.map((m) => (
                <div key={`${m.date}-${m.mealType}`} className="break-inside-avoid">
                  <p className="text-xs font-semibold text-slate-700">
                    {formatDateTr(m.date, { short: true })} · {m.mealLabel}
                  </p>
                  <ul className="text-xs text-slate-700 pl-3">
                    {m.items.map((i, idx) => (
                      <li key={idx}>
                        {i.time} {i.name} · {formatNumberTr(i.grams)} g · {formatNumberTr(i.kcal)} kcal · {formatNumberTr(i.protein)} g protein
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}

          {r.supplements.length > 0 && (
            <section aria-label="Takviyeler">
              <h2 className="font-bold text-slate-900 mb-1">Takviyeler</h2>
              <ul className="text-xs text-slate-700">
                {r.supplements.map((s) => (
                  <li key={s.name}>
                    {s.name} ({s.dose}): {s.takenDays} gün
                  </li>
                ))}
              </ul>
            </section>
          )}

          <footer className="pt-3 border-t border-slate-200 text-[11px] text-slate-500">
            Bu rapor kullanıcının kendi kayıtlarından üretildi; besin değerleri katalog ve etiket bilgisine dayanır ve tahmini olabilir.
          </footer>
        </article>
      )}
    </div>
  );
}
