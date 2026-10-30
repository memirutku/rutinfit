"use client";

import { useState } from "react";
import { useTimedMessage } from "@/hooks/useTimedMessage";
import type { ProgressResponse } from "@/lib/schemas/progress";
import { WELLBEING_SECTION_ID } from "./rhythm";
import { parseDecimalTr } from "@/lib/format";
import { computeReadiness, READINESS_BAND_LABELS, type ReadinessBand } from "@/lib/readiness";

const READINESS_TONE: Record<ReadinessBand, string> = { low: "text-rose-700", medium: "text-amber-700", high: "text-emerald-700" };

export interface WellbeingValues {
  weightKg?: number;
  energy1to5: number;
  sleepMinutes: number;
  /** F51 */
  stress1to5?: number;
  soreness1to5?: number;
  mood1to5?: number;
}

type Scales = Pick<WellbeingValues, "stress1to5" | "soreness1to5" | "mood1to5">;

/** Form alanlarını kayıt gövdesine çevirir. Virgüllü ondalık kabul edilir; boş uyku 7 saattir. */
export function toWellbeingValues(weight: string, sleepHours: string, energy: number, scales: Scales = {}): WellbeingValues {
  const w = parseDecimalTr(weight) ?? NaN;
  const h = parseDecimalTr(sleepHours) ?? NaN;
  const extra = Object.fromEntries(Object.entries(scales).filter(([, v]) => typeof v === "number")) as Scales;
  return {
    weightKg: Number.isFinite(w) && w > 0 ? w : undefined,
    energy1to5: energy,
    sleepMinutes: Number.isFinite(h) ? Math.round(h * 60) : 420,
    ...extra,
  };
}

/** F51: 1–5 ölçeği (düğmeler "Kas ağrısı 3/5" gibi adlandırılır). */
function Scale({ label, hint, value, onChange }: { label: string; hint: string; value: number | null; onChange: (v: number) => void }) {
  return (
    <div role="group" aria-label={label}>
      <span className="block text-[11px] font-semibold text-slate-600 mb-1">
        {label} <span className="font-normal text-slate-400">({hint})</span>
      </span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${label} ${n}/5`}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className={`flex-1 py-1 rounded-md text-[11px] font-semibold border ${
              value === n ? "bg-slate-800 text-white border-slate-800" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

interface WellbeingCardProps {
  /** Sunucudaki bugünün kaydı; değerleri değişince form yeniden doldurulur. */
  today?: ProgressResponse["today"];
  /** true dönerse "Kayıt güncellendi ✓" gösterilir; hata mesajını çağıran gösterir. */
  onSave: (values: WellbeingValues) => Promise<boolean>;
}

/** Günlük iyilik hâli hızlı girişi (takviyeler F15 ile ayrı kartta). */
export function WellbeingCard({ today, onSave }: WellbeingCardProps) {
  const [weight, setWeight] = useState("");
  const [energy, setEnergy] = useState(3);
  const [sleep, setSleep] = useState("7");
  const [stress, setStress] = useState<number | null>(null);
  const [soreness, setSoreness] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const saved = useTimedMessage<string>(3000);

  // Sunucu değerleri değiştiğinde (ilk yükleme, kayıt sonrası) form doldurulur. Yalnız kreatin
  // gibi formda olmayan alanlar değiştiğinde veya aynı veri yeniden geldiğinde kullanıcının yazdıkları ezilmez.
  // Effect yerine render sırasında: boş formla bir kare çizilmez.
  const signature = today
    ? [today.date, today.weightKg, today.energy1to5, today.sleepMinutes, today.stress1to5, today.soreness1to5, today.mood1to5].join("|")
    : null;
  const [seededSignature, setSeededSignature] = useState<string | null>(null);
  if (today && signature !== seededSignature) {
    setSeededSignature(signature);
    if (today.weightKg) setWeight(String(today.weightKg));
    if (today.energy1to5) setEnergy(today.energy1to5);
    if (today.sleepMinutes) setSleep(String(today.sleepMinutes / 60));
    if (today.stress1to5) setStress(today.stress1to5);
    if (today.soreness1to5) setSoreness(today.soreness1to5);
    if (today.mood1to5) setMood(today.mood1to5);
  }

  // F51: formdaki değerlerden canlı hazır olma skoru.
  const sleepHours = parseDecimalTr(sleep);
  const readiness = computeReadiness({
    sleepMinutes: sleepHours !== null ? sleepHours * 60 : null,
    energy1to5: energy,
    stress1to5: stress,
    soreness1to5: soreness,
    mood1to5: mood,
  });
  const scales: Scales = { stress1to5: stress ?? undefined, soreness1to5: soreness ?? undefined, mood1to5: mood ?? undefined };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    saved.clear();
    try {
      if (await onSave(toWellbeingValues(weight, sleep, energy, scales))) saved.show("Kayıt güncellendi ✓");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      id={WELLBEING_SECTION_ID}
      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Günlük Ritim</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Sabah Kilosu */}
            <div>
              <label htmlFor="dash-field-1" className="block text-xs font-semibold text-slate-600 mb-1">
                Sabah Kilosu (kg)
              </label>
              <input
                id="dash-field-1"
                type="text"
                inputMode="decimal"
                placeholder="Örn: 112,0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
              />
            </div>

            {/* Uyku Süresi */}
            <div>
              <label htmlFor="dash-field-2" className="block text-xs font-semibold text-slate-600 mb-1">
                Uyku (saat)
              </label>
              <input
                id="dash-field-2"
                type="text"
                inputMode="decimal"
                placeholder="Örn: 7,5"
                value={sleep}
                onChange={(e) => setSleep(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Enerji Seviyesi (1-5) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Günlük Enerji Seviyesi: <span className="text-slate-900 font-bold">{energy} / 5</span>
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setEnergy(level)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                    energy === level
                      ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* F51: hazır olma girdileri */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Scale label="Stres" hint="1 az, 5 çok" value={stress} onChange={setStress} />
            <Scale label="Kas ağrısı" hint="1 yok, 5 çok" value={soreness} onChange={setSoreness} />
            <Scale label="Ruh hâli" hint="1 kötü, 5 iyi" value={mood} onChange={setMood} />
          </div>

          {readiness && (
            <p className="text-xs text-slate-600">
              <span className={`font-bold ${READINESS_TONE[readiness.band]}`}>
                Hazır olma: {readiness.score} · {READINESS_BAND_LABELS[readiness.band]}
              </span>
              {readiness.drags.length > 0 && <span className="block text-slate-500">Düşüren: {readiness.drags.slice(0, 2).join(", ")}</span>}
            </p>
          )}

          <div className="pt-2 flex items-center justify-between">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
            {saved.message && <span className="text-xs text-emerald-600 font-medium">{saved.message}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
