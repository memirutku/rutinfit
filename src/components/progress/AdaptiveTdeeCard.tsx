"use client";

import { useQuery } from "@tanstack/react-query";
import { Gauge } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { Explanation } from "@/components/ui/Explanation";
import { apiFetch } from "@/lib/client/api";
import { formatDateTr, formatNumberTr } from "@/lib/format";

type AdaptiveResponse =
  | {
      ok: true;
      tdee: number;
      confidence: "high" | "medium";
      avgIntake: number;
      weightChangeKgPerWeek: number;
      loggedDays: number;
      windowDays: number;
      weighIns: number;
      from: string;
      to: string;
      weights: Array<{ date: string; kg: number }>;
      formulaTdee: number | null;
      currentTarget: number | null;
      suggestion: { calorieTarget: number; delta: number; reason: string } | null;
    }
  | { ok: false; reason: string };

const signed = (n: number) => (n < 0 ? `−${formatNumberTr(-n)}` : n > 0 ? `+${formatNumberTr(n)}` : "0");

/** F10: Adaptif harcama tahmini; F57 açıklamasıyla. */
export function AdaptiveTdeeCard() {
  const { data } = useQuery({ queryKey: ["progress", "adaptive-tdee"], queryFn: () => apiFetch<AdaptiveResponse>("/api/progress/adaptive-tdee") });
  if (!data) return null;

  return (
    <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <Gauge className="w-5 h-5 text-brand-600" />
        <h3 className="font-bold text-slate-900 text-base">Gerçek harcama tahmini</h3>
      </div>
      {!data.ok ? (
        <p className="text-sm text-slate-500">Tahmin için daha fazla veri gerekiyor. {data.reason}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-extrabold text-slate-900">{formatNumberTr(data.tdee)} kcal</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${data.confidence === "high" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
              {data.confidence === "high" ? "Yüksek güven" : "Orta güven"}
            </span>
            {data.formulaTdee !== null && <span className="text-xs text-slate-500">(formül {formatNumberTr(data.formulaTdee)} kcal)</span>}
          </div>
          {data.suggestion ? (
            <p className="p-3 rounded-xl bg-brand-50 border border-brand-200 text-sm text-brand-900">
              Önerilen günlük hedef: <strong>{formatNumberTr(data.suggestion.calorieTarget)} kcal</strong> (şu an {formatNumberTr(data.currentTarget ?? 0)},{" "}
              {signed(data.suggestion.delta)}). {data.suggestion.reason} Haftalık değerlendirmede onaylayabilirsin.
            </p>
          ) : (
            <p className="text-xs text-slate-500">Mevcut hedefin bu tahminle uyumlu.</p>
          )}
          <Explanation
            title="Bu tahmin neye dayanıyor?"
            items={[
              { label: "Dönem", value: `${formatDateTr(data.from)} – ${formatDateTr(data.to)}` },
              { label: "Ortalama alım", value: `${formatNumberTr(data.avgIntake)} kcal (${data.loggedDays}/${data.windowDays} gün kayıtlı)` },
              { label: "Kilo eğilimi", value: `${signed(data.weightChangeKgPerWeek)} kg / hafta (${data.weighIns} tartı)` },
            ]}
            formula={`${formatNumberTr(data.avgIntake)} − (${signed(data.weightChangeKgPerWeek)} kg ÷ 7 gün × 7.700 kcal) ≈ ${formatNumberTr(data.tdee)} kcal`}
          >
            {data.weights.length > 1 && (
              <div className="h-16" aria-label="Kilo eğilimi grafiği">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.weights}>
                    <YAxis hide domain={["auto", "auto"]} />
                    <Line type="monotone" dataKey="kg" stroke="#0f766e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Explanation>
        </>
      )}
    </section>
  );
}
