"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { formatNumberTr } from "@/lib/format";

interface Plate {
  weight: number;
  colorBg: string;
  colorBorder: string;
  textColor: string;
  heightPx: number;
}

const AVAILABLE_PLATES: Plate[] = [
  { weight: 25, colorBg: "bg-red-600", colorBorder: "border-red-700", textColor: "text-white", heightPx: 96 },
  { weight: 20, colorBg: "bg-blue-600", colorBorder: "border-blue-700", textColor: "text-white", heightPx: 90 },
  { weight: 15, colorBg: "bg-amber-400", colorBorder: "border-amber-500", textColor: "text-slate-900", heightPx: 80 },
  { weight: 10, colorBg: "bg-emerald-600", colorBorder: "border-emerald-700", textColor: "text-white", heightPx: 70 },
  { weight: 5, colorBg: "bg-slate-200", colorBorder: "border-slate-400", textColor: "text-slate-800", heightPx: 56 },
  { weight: 2.5, colorBg: "bg-slate-900", colorBorder: "border-slate-950", textColor: "text-white", heightPx: 44 },
  { weight: 1.25, colorBg: "bg-zinc-400", colorBorder: "border-zinc-500", textColor: "text-slate-900", heightPx: 36 },
];

export function PlateCalculator() {
  const [targetWeight, setTargetWeight] = useState<number>(100);
  const [barWeight, setBarWeight] = useState<number>(20);
  const [collarWeight, setCollarWeight] = useState<number>(0); // klips ağırlığı

  // 1RM Hesaplayıcı durumu
  const [oneRmWeight, setOneRmWeight] = useState<number>(80);
  const [oneRmReps, setOneRmReps] = useState<number>(8);

  // Plaka Matematiği
  function calculatePlates(target: number, bar: number, collar: number) {
    const netWeight = target - bar - collar * 2;
    if (netWeight <= 0) {
      return { perSideWeight: 0, platesPerSide: [], remainder: 0 };
    }

    const perSide = netWeight / 2;
    let remaining = perSide;
    const plates: { plate: Plate; count: number }[] = [];

    for (const p of AVAILABLE_PLATES) {
      if (remaining >= p.weight) {
        const count = Math.floor(remaining / p.weight);
        plates.push({ plate: p, count });
        remaining = Math.round((remaining - count * p.weight) * 100) / 100;
      }
    }

    return {
      perSideWeight: perSide,
      platesPerSide: plates,
      remainder: remaining,
    };
  }

  const result = calculatePlates(targetWeight, barWeight, collarWeight);

  // 1RM Hesaplamaları (Brzycki & Epley)
  const epley1Rm = Math.round(oneRmWeight * (1 + 0.0333 * oneRmReps));
  const brzycki1Rm = Math.round(
    oneRmWeight / (1.0278 - 0.0278 * Math.min(oneRmReps, 12))
  );
  const avg1Rm = Math.round((epley1Rm + brzycki1Rm) / 2);

  const percentageTable = [
    { pct: 95, reps: "1-2" },
    { pct: 90, reps: "3-4" },
    { pct: 85, reps: "5-6" },
    { pct: 80, reps: "7-8" },
    { pct: 75, reps: "9-10" },
    { pct: 70, reps: "11-12" },
  ];

  return (
    <div className="space-y-6">
      {/* Plaka Hesaplayıcı Ana Kart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-lg">
              Olimpik Bar Plaka Hesaplayıcı 🏋️
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
              Yerel Matematik Motoru
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Hedef ağırlığa ulaşmak için halterin her iki tarafına takmanız gereken plakaları hesaplar.
          </p>
        </div>

        {/* Girdi Alanları */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Hedef Toplam Ağırlık (kg)
            </label>
            <div className="relative">
              <DecimalInput
                aria-label="Hedef Toplam Ağırlık (kg)"
                value={targetWeight}
                onValueChange={(v) => setTargetWeight(Math.max(0, v))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-extrabold text-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <span className="absolute right-3.5 top-3 text-xs font-bold text-slate-400">
                kg
              </span>
            </div>
            {/* Hızlı butonlar */}
            <div className="flex gap-1.5 mt-2">
              {[60, 80, 100, 120, 140].map((w) => (
                <button
                  key={w}
                  onClick={() => setTargetWeight(w)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
                    targetWeight === w
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {w}k
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Bar Tipi ve Ağırlığı
            </label>
            <select
              value={barWeight}
              onChange={(e) => setBarWeight(parseFloat(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="20">Standart Erkek Olimpik Bar (20 kg)</option>
              <option value="15">Kadın Olimpik Bar (15 kg)</option>
              <option value="10">EZ Curl Bar (10 kg)</option>
              <option value="8">Smith Machine Bar (~8 kg)</option>
              <option value="0">Yalnızca Plakalar (0 kg)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Klips / Kilit Ağırlığı (Adet)
            </label>
            <select
              value={collarWeight}
              onChange={(e) => setCollarWeight(parseFloat(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="0">Klips Yok / Hafif Plastik (0 kg)</option>
              <option value="0.5">Yaylı Metal Klips (0.5 kg)</option>
              <option value="2.5">Olimpik Yarışma Kilidi (2.5 kg)</option>
            </select>
          </div>
        </div>

        {/* Sonuç Kartı ve Görsel Bar Temsili */}
        <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 text-white space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <span className="text-xs text-slate-400 font-medium">
                Her Bir Tarafa Takılacak Plaka Ağırlığı:
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-400">
                  {formatNumberTr(result.perSideWeight)} kg
                </span>
                <span className="text-xs text-slate-400">
                  (Toplam: Bar {formatNumberTr(barWeight)} kg + 2 × {formatNumberTr(result.perSideWeight)} kg)
                </span>
              </div>
            </div>

            {result.remainder > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-900/60 border border-amber-700 rounded-xl text-amber-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {result.remainder * 2} kg eksik (mevcut en küçük plaka 1.25 kg)
                </span>
              </div>
            )}
          </div>

          {/* Görsel Halter Manşonu (Bar Sleeve) */}
          <div className="py-6 flex items-center justify-center overflow-x-auto">
            <div className="flex items-center min-w-[320px]">
              {/* Halter Barı (Merkez) */}
              <div className="w-24 h-5 bg-gradient-to-r from-slate-400 via-slate-200 to-slate-400 rounded-l shadow-inner border border-slate-500 relative flex items-center justify-center">
                <span className="text-[10px] font-bold text-slate-800">
                  BAR {formatNumberTr(barWeight)}kg
                </span>
              </div>

              {/* Bar Flanşı (Bilezik) */}
              <div className="w-4 h-24 bg-slate-600 border border-slate-500 shadow-md" />

              {/* Takılan Plakalar (İçten Dışa) */}
              <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-4 rounded-r border-y border-r border-slate-700 min-h-[110px]">
                {result.platesPerSide.length === 0 ? (
                  <span className="text-xs text-slate-500 italic px-4">
                    Boş Bar
                  </span>
                ) : (
                  result.platesPerSide.flatMap(({ plate, count }) =>
                    Array.from({ length: count }).map((_, idx) => (
                      <div
                        key={`${plate.weight}-${idx}`}
                        style={{ height: `${plate.heightPx}px` }}
                        className={`w-7 rounded-sm border ${plate.colorBg} ${plate.colorBorder} shadow-lg flex flex-col items-center justify-center select-none transform transition-transform hover:scale-105`}
                        title={`${plate.weight} kg`}
                      >
                        <span
                          className={`text-[10px] font-extrabold ${plate.textColor} transform -rotate-90`}
                        >
                          {plate.weight}
                        </span>
                      </div>
                    ))
                  )
                )}

                {/* Klips */}
                {collarWeight > 0 && (
                  <div className="w-3 h-12 bg-amber-500 rounded border border-amber-600 shadow-xs ml-1" title="Klips" />
                )}
              </div>
            </div>
          </div>

          {/* Liste Biçiminde Plaka Dökümü */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
            <span className="text-xs text-slate-400 font-semibold mr-1">
              Plaka Listesi (Tek Taraf):
            </span>
            {result.platesPerSide.length === 0 ? (
              <span className="text-xs text-slate-500">Ek plaka gerekmiyor.</span>
            ) : (
              result.platesPerSide.map(({ plate, count }) => (
                <span
                  key={plate.weight}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${plate.colorBg} ${plate.colorBorder} ${plate.textColor}`}
                >
                  <span>{count} × {plate.weight} kg</span>
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 1RM (Tek Tekrar Maksimumu) Hesaplayıcı */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-900 text-base">
              1RM (Tek Tekrar Maksimumu) ve Yüzde Dağılımı 🎯
            </h4>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tamamladığınız ağırlık ve tekrardan tahmini tek tekrar gücünüzü ve çalışma yüzdelerini hesaplar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Kaldırılan Ağırlık (kg)
            </label>
            <DecimalInput
              aria-label="Kaldırılan Ağırlık (kg)"
              value={oneRmWeight}
              onValueChange={(v) => setOneRmWeight(Math.max(0, v))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Tekrar Sayısı (Reps)
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={oneRmReps}
              onChange={(e) => setOneRmReps(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm"
            />
          </div>
        </div>

        {/* 1RM Sonuç Özeti */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          <div className="p-3.5 bg-brand-50 border border-brand-200 rounded-xl">
            <span className="text-[11px] font-bold text-brand-700 uppercase block mb-0.5">
              Ortalama 1RM
            </span>
            <span className="text-2xl font-extrabold text-brand-900">
              {avg1Rm} kg
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-bold text-slate-500 uppercase block mb-0.5">
              Epley Formülü
            </span>
            <span className="text-xl font-extrabold text-slate-800">
              {epley1Rm} kg
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-bold text-slate-500 uppercase block mb-0.5">
              Brzycki Formülü
            </span>
            <span className="text-xl font-extrabold text-slate-800">
              {brzycki1Rm} kg
            </span>
          </div>
        </div>

        {/* Antrenman Yüzdeleri Tablosu */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-700 block">
            Çalışma Hedefi Ağırlıkları (%1RM):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {percentageTable.map(({ pct, reps }) => {
              const weightAtPct = Math.round((avg1Rm * pct) / 100 / 2.5) * 2.5;
              return (
                <div
                  key={pct}
                  className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center"
                >
                  <span className="text-[11px] font-extrabold text-brand-600 block">
                    %{pct}
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 block my-0.5">
                    {weightAtPct} kg
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ~{reps} tekrar
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
