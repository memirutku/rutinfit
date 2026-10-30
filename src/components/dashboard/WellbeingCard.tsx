"use client";

import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { useTimedMessage } from "@/hooks/useTimedMessage";
import type { ProgressResponse } from "@/lib/schemas/progress";
import { WELLBEING_SECTION_ID } from "./rhythm";
import { parseDecimalTr } from "@/lib/format";

export interface WellbeingValues {
  weightKg?: number;
  energy1to5: number;
  sleepMinutes: number;
}

/** Form alanlarını kayıt gövdesine çevirir. Virgüllü ondalık kabul edilir; boş uyku 7 saattir. */
export function toWellbeingValues(weight: string, sleepHours: string, energy: number): WellbeingValues {
  const w = parseDecimalTr(weight) ?? NaN;
  const h = parseDecimalTr(sleepHours) ?? NaN;
  return {
    weightKg: Number.isFinite(w) && w > 0 ? w : undefined,
    energy1to5: energy,
    sleepMinutes: Number.isFinite(h) ? Math.round(h * 60) : 420,
  };
}

interface WellbeingCardProps {
  /** Sunucudaki bugünün kaydı; değerleri değişince form yeniden doldurulur. */
  today?: ProgressResponse["today"];
  onToggleCreatine: () => void;
  /** true dönerse "Kayıt güncellendi ✓" gösterilir; hata mesajını çağıran gösterir. */
  onSave: (values: WellbeingValues) => Promise<boolean>;
}

/** Günlük Kreatin & İyilik Hali Hızlı Giriş */
export function WellbeingCard({ today, onToggleCreatine, onSave }: WellbeingCardProps) {
  const [weight, setWeight] = useState("");
  const [energy, setEnergy] = useState(3);
  const [sleep, setSleep] = useState("7");
  const [saving, setSaving] = useState(false);
  const saved = useTimedMessage<string>(3000);
  const creatineTaken = !!today?.creatineTaken;

  // Sunucu değerleri değiştiğinde (ilk yükleme, kayıt sonrası) form doldurulur. Yalnız kreatin
  // değiştiğinde veya aynı veri yeniden geldiğinde kullanıcının yazdıkları ezilmez.
  // Effect yerine render sırasında: boş formla bir kare çizilmez.
  const signature = today ? [today.date, today.weightKg, today.energy1to5, today.sleepMinutes].join("|") : null;
  const [seededSignature, setSeededSignature] = useState<string | null>(null);
  if (today && signature !== seededSignature) {
    setSeededSignature(signature);
    if (today.weightKg) setWeight(String(today.weightKg));
    if (today.energy1to5) setEnergy(today.energy1to5);
    if (today.sleepMinutes) setSleep(String(today.sleepMinutes / 60));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    saved.clear();
    try {
      if (await onSave(toWellbeingValues(weight, sleep, energy))) saved.show("Kayıt güncellendi ✓");
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
          <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Günlük Ritim & Kreatin</span>
          <button
            type="button"
            onClick={onToggleCreatine}
            aria-pressed={creatineTaken}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              creatineTaken
                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            {creatineTaken ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <Circle className="w-4 h-4 text-slate-400" />
            )}
            <span>5g Kreatin Alındı</span>
          </button>
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

      <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
        <p>💡 Dinlenme günleri dahil günlük 5g kreatin kullanımı kas doygunluğunu korur.</p>
      </div>
    </div>
  );
}
