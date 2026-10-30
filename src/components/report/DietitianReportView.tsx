"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Printer } from "lucide-react";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { downloadFile } from "@/lib/client/download";
import { PathActions } from "@/components/ui/PathActions";
import { addDaysToDateString, getLocalDateString } from "@/lib/date-utils";
import { formatDateTr, formatDecimalTr, formatNumberTr } from "@/lib/format";
import { ADHERENCE_LABELS } from "@/lib/adherence";
import type { DietitianReport } from "@/lib/services/dietitian-report";
import { deviationText as deviation, type DeviationStatus } from "@/lib/report-targets";

const n = (v: number | null | undefined, unit = "") => (v === null || v === undefined ? "—" : `${formatNumberTr(v)}${unit}`);
/** İşaretli fark: +200, -2 (sıfır işaretsiz). */
const signed = (v: number, unit = "") => `${v > 0 ? "+" : ""}${formatNumberTr(v)}${unit}`;
const GOAL_TR: Record<string, string> = { lose: "Kilo vermek", maintain: "Kilo korumak", gain: "Kilo almak" };
const TH = "px-2 py-1.5 text-left font-semibold text-slate-600 border-b border-slate-200";
const TD = "px-2 py-1 border-b border-slate-100";
const H2 = "font-bold text-slate-900 mb-1";
const EMPTY = "text-xs text-slate-500";
const WEEKDAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const weekday = (iso: string) => WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];

/** B43: hedeften sapma rengi; siyah-beyaz baskıda da anlaşılsın diye sözle de yazılır. */
const STATUS: Record<DeviationStatus, { label: string; card: string; text: string }> = {
  ok: { label: "Hedefe uygun", card: "border-l-emerald-500", text: "text-emerald-700" },
  warn: { label: "Dikkat", card: "border-l-amber-500", text: "text-amber-700" },
  off: { label: "Hedeften sapma", card: "border-l-rose-500", text: "text-rose-700" },
};

const adherenceStatus = (percent: number | null): DeviationStatus | undefined =>
  percent === null ? undefined : percent >= 80 ? "ok" : percent >= 60 ? "warn" : "off";

interface SummaryCard {
  label: string;
  value: string;
  status?: DeviationStatus;
  detail?: string;
}

function SummaryCardView({ card }: { card: SummaryCard }) {
  const tone = card.status ? STATUS[card.status] : null;
  return (
    <div
      role="group"
      aria-label={card.label}
      data-status={card.status}
      className={`p-2 rounded-lg bg-slate-50 print:bg-white print:border print:border-slate-200 break-inside-avoid ${tone ? `border-l-4 ${tone.card}` : ""}`}
    >
      <p className="text-[11px] text-slate-500">{card.label}</p>
      <p className="font-bold text-slate-900">{card.value}</p>
      {tone && <p className={`text-[11px] font-semibold ${tone.text}`}>{tone.label}</p>}
      {card.detail && <p className="text-[11px] text-slate-600">{card.detail}</p>}
    </div>
  );
}

/** B43: öğün günlüğü güne göre gruplanır; günün toplamı başlıkta yazar. */
function groupMealsByDay(r: DietitianReport) {
  const byDate = new Map<string, DietitianReport["meals"]>();
  for (const m of r.meals) byDate.set(m.date, [...(byDate.get(m.date) ?? []), m]);
  return [...byDate.entries()].map(([date, meals]) => ({
    date,
    meals,
    kcal: r.days.find((d) => d.date === date)?.kcal ?? meals.reduce((a, m) => a + m.items.reduce((b, i) => b + i.kcal, 0), 0),
  }));
}

/** F77: Diyetisyene rapor. Yazdır › PDF olarak kaydet ya da Excel indir. */
export function DietitianReportView({ today = getLocalDateString() }: { today?: string }) {
  const [range, setRange] = useState({ from: addDaysToDateString(today, -6), to: today });
  // B36: indirilen dosyanın yeri ve Finder düğmeleri (ham yol yerine).
  const [exported, setExported] = useState<{ name: string; savedPath: string | null } | null>(null);
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
      setExported({ name, savedPath: savedPath ?? null });
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
        {exported && (
          <div role="status" className="w-full space-y-1.5 text-xs text-emerald-800 print:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold [overflow-wrap:anywhere]">{`Excel indirildi: ${exported.name} (İndirilenler klasörü)`}</p>
              <PathActions target={{ download: exported.name }} revealLabel="İndirilen Excel dosyasını Finder'da göster" />
            </div>
            {exported.savedPath && (
              <div className="flex flex-wrap items-center gap-2 text-slate-600">
                <p>Bir kopyası uygulama klasöründe.</p>
                <PathActions
                  target={{ path: exported.savedPath }}
                  revealLabel="Uygulama klasöründeki kopyayı Finder'da göster"
                  copy={{ text: exported.savedPath, label: "Uygulama klasöründeki kopyanın yolunu kopyala" }}
                />
              </div>
            )}
          </div>
        )}
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
            {(
              [
                { label: "Kayıtlı gün", value: `${r.loggedDays} / ${r.dayCount}` },
                { label: "Hedef aralığında", value: `${r.daysOnTarget} gün` },
                { label: "Ort. kalori", value: n(r.averages.kcal, " kcal"), status: r.targets?.kcal?.status, detail: r.targets?.kcal ? deviation(r.targets.kcal, "kcal") : undefined },
                { label: "Ort. protein", value: n(r.averages.protein, " g"), status: r.targets?.protein?.status, detail: r.targets?.protein ? deviation(r.targets.protein, "g") : undefined },
                { label: "Ort. karbonhidrat", value: n(r.averages.carbs, " g"), status: r.targets?.carbs?.status, detail: r.targets?.carbs ? deviation(r.targets.carbs, "g") : undefined },
                { label: "Ort. yağ", value: n(r.averages.fat, " g"), status: r.targets?.fat?.status, detail: r.targets?.fat ? deviation(r.targets.fat, "g") : undefined },
                {
                  label: "Plana uyum",
                  value: r.adherence?.overall.percent != null ? `%${r.adherence.overall.percent}` : "—",
                  status: adherenceStatus(r.adherence?.overall.percent ?? null),
                  detail: r.adherence ? `${r.adherence.overall.marked} / ${r.adherence.overall.planned} planlı öğün işaretli` : undefined,
                },
                { label: "Kilo değişimi", value: r.weight ? `${n(r.weight.start)} → ${n(r.weight.end)} kg (${signed(r.weight.change)})` : "—" },
                { label: "Antrenman / kardiyo", value: `${r.training.sessions} seans · ${n(r.training.cardioMin, " dk")}` },
              ] satisfies SummaryCard[]
            ).map((card) => (
              <SummaryCardView key={card.label} card={card} />
            ))}
          </section>

          <section aria-label="Vücut ölçüleri" className="overflow-x-auto break-inside-avoid">
            <h2 className={H2}>Vücut ölçüleri</h2>
            {r.measurements?.length ? (
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {["Ölçü", "İlk", "Son", "Fark"].map((h) => (
                      <th key={h} scope="col" className={TH}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.measurements.map((m) => {
                    const unit = m.unit ? ` ${m.unit}` : "";
                    // Bel/kalça oranı iki ondalıkla anlamlıdır (0,86); diğerleri tek ondalık.
                    const v = (x: number) => (m.key === "waistHipRatio" ? formatDecimalTr(x, 2) : formatNumberTr(x)) + unit;
                    return (
                      <tr key={m.key}>
                        <th scope="row" className={`${TD} text-left font-semibold`}>
                          {m.label}
                        </th>
                        <td className={TD}>
                          {v(m.first.value)} <span className="text-slate-400">({formatDateTr(m.first.date, { short: true })})</span>
                        </td>
                        <td className={TD}>
                          {v(m.last.value)} <span className="text-slate-400">({formatDateTr(m.last.date, { short: true })})</span>
                        </td>
                        <td className={`${TD} font-semibold`}>{m.change === null ? "—" : `${m.change > 0 ? "+" : ""}${v(m.change)}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className={EMPTY}>Bu dönemde ölçü kaydı yok.</p>
            )}
          </section>

          <section aria-label="Plana uyum" className="overflow-x-auto break-inside-avoid">
            <h2 className={H2}>Plana uyum (haftalık)</h2>
            {r.adherence?.weeks.some((w) => w.planned > 0) ? (
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {["Hafta", "Planlı öğün", "İşaretli", "Uygulandı", "Kısmen", "Atlandı", "Uyum"].map((h) => (
                      <th key={h} scope="col" className={TH}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.adherence.weeks.map((w) => {
                    const tone = adherenceStatus(w.percent);
                    return (
                      <tr key={w.weekStart}>
                        <th scope="row" className={`${TD} text-left font-semibold`}>
                          {formatDateTr(w.from, { short: true })} – {formatDateTr(w.to, { short: true })}
                        </th>
                        <td className={TD}>{w.planned}</td>
                        <td className={TD}>{w.marked}</td>
                        <td className={TD}>{w.done}</td>
                        <td className={TD}>{w.partial}</td>
                        <td className={TD}>{w.skipped}</td>
                        <td className={`${TD} font-bold ${tone ? STATUS[tone].text : ""}`}>{w.percent === null ? "—" : `%${w.percent}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className={EMPTY}>Bu dönemde yemek planı girilmemiş.</p>
            )}
            <p className="mt-1 text-[11px] text-slate-500">Uygulandı 1, kısmen 0,5, atlandı 0 puan; işaretlenmemiş öğün sayılmaz.</p>
          </section>

          {r.planVsActual?.length ? (
            <section aria-label="Plan ve gerçekleşen" className="overflow-x-auto">
              <h2 className={H2}>Öğün bazında plan ve gerçekleşen</h2>
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {["Tarih", "Öğün", "Plan", "Plan (kcal)", "Gerçekleşen (kcal)", "Fark", "Uyum"].map((h) => (
                      <th key={h} scope="col" className={TH}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.planVsActual.map((p) => {
                    // Plandan %20'den fazla sapan öğün işaretlenir.
                    const far = p.diffKcal !== null && p.plannedKcal ? Math.abs(p.diffKcal) / p.plannedKcal > 0.2 : false;
                    return (
                      <tr key={`${p.date}-${p.mealType}`} className="break-inside-avoid">
                        <td className={TD}>{formatDateTr(p.date, { short: true })}</td>
                        <td className={TD}>{p.mealLabel}</td>
                        <td className={`${TD} break-words`}>{p.planned ?? <span className="italic text-slate-500">Plan dışı</span>}</td>
                        <td className={TD}>{n(p.plannedKcal)}</td>
                        <td className={TD}>{p.actualCount ? n(p.actualKcal) : <span className="text-slate-500">Kayıt yok</span>}</td>
                        <td className={`${TD} ${far ? "font-bold text-amber-700" : ""}`}>{p.diffKcal === null ? "—" : signed(p.diffKcal)}</td>
                        <td className={TD}>{p.adherence ? ADHERENCE_LABELS[p.adherence] : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ) : null}

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
            <section aria-label="Öğün günlüğü" className="space-y-3 print:break-before-page">
              <h2 className="font-bold text-slate-900">Öğün günlüğü</h2>
              {groupMealsByDay(r).map((day) => (
                <div key={day.date} role="group" aria-label={`${formatDateTr(day.date, { short: true })} ${weekday(day.date)}`} className="break-inside-avoid border-l-2 border-slate-200 pl-3">
                  <h3 className="text-xs font-bold text-slate-900">
                    {formatDateTr(day.date, { short: true })} {weekday(day.date)} · {n(day.kcal, " kcal")}
                  </h3>
                  {day.meals.map((m) => (
                    <div key={m.mealType} className="mt-1">
                      <p className="text-[11px] font-semibold text-slate-600">{m.mealLabel}</p>
                      <ul className="text-xs text-slate-700 pl-3">
                        {m.items.map((i, idx) => (
                          <li key={idx}>
                            {i.time} {i.name}
                            {i.grams > 0 && ` · ${formatNumberTr(i.grams)} g`} · {formatNumberTr(i.kcal)} kcal · {formatNumberTr(i.protein)} g protein
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
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
