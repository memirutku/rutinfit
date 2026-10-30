"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ruler } from "lucide-react";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { queryKeys } from "@/lib/client/queries/keys";
import { formatDateTr, formatNumberTr } from "@/lib/format";
import type { BodyMetricField, BloodPressureLevel } from "@/lib/services/body-metrics";

interface BodyMetricsResponse {
  latest: Partial<Record<BodyMetricField, { value: number; date: string }>>;
  changes: Partial<Record<BodyMetricField, { from: number; to: number; delta: number }>>;
  waistToHeight: { ratio: number; elevated: boolean } | null;
  bloodPressure: { date: string; systolic: number; diastolic: number; level: BloodPressureLevel; message: string } | null;
}

const FIELDS: Array<{ key: BodyMetricField; label: string; unit: string; input: string }> = [
  { key: "waistCm", label: "Bel", unit: "cm", input: "Bel (cm)" },
  { key: "hipCm", label: "Kalça", unit: "cm", input: "Kalça (cm)" },
  { key: "chestCm", label: "Göğüs", unit: "cm", input: "Göğüs (cm)" },
  { key: "armCm", label: "Kol", unit: "cm", input: "Kol (cm)" },
  { key: "thighCm", label: "Bacak", unit: "cm", input: "Bacak (cm)" },
  { key: "neckCm", label: "Boyun", unit: "cm", input: "Boyun (cm)" },
  { key: "bodyFatPercent", label: "Yağ oranı", unit: "%", input: "Yağ oranı (%)" },
  { key: "restingHr", label: "Dinlenik nabız", unit: "atım/dk", input: "Dinlenik nabız" },
  { key: "systolic", label: "Büyük tansiyon", unit: "mmHg", input: "Büyük tansiyon" },
  { key: "diastolic", label: "Küçük tansiyon", unit: "mmHg", input: "Küçük tansiyon" },
];
const SHOWN: BodyMetricField[] = ["waistCm", "hipCm", "chestCm", "armCm", "thighCm", "neckCm", "bodyFatPercent", "restingHr"];
const INTS = new Set<BodyMetricField>(["restingHr", "systolic", "diastolic"]);
const BP_TONE: Record<BloodPressureLevel, string> = {
  very_high: "bg-rose-50 border-rose-300 text-rose-900",
  high: "bg-amber-50 border-amber-300 text-amber-900",
  elevated: "bg-amber-50 border-amber-200 text-amber-900",
  low: "bg-amber-50 border-amber-200 text-amber-900",
  normal: "bg-emerald-50 border-emerald-200 text-emerald-900",
};
const signed = (n: number) => (n < 0 ? `−${formatNumberTr(-n)}` : n > 0 ? `+${formatNumberTr(n)}` : "0");
const KEY = [...queryKeys.progress, "body-metrics"];

/** F16: Vücut ölçüleri ve sağlık metrikleri. Uyarılar teşhis değildir. */
export function BodyMetricsSection({ today }: { today: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: KEY, queryFn: () => apiFetch<BodyMetricsResponse>("/api/body-metrics") });
  const [date, setDate] = useState(today);
  const [values, setValues] = useState<Partial<Record<BodyMetricField, number>>>({});
  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { date };
      for (const f of FIELDS) {
        const v = values[f.key];
        if (v !== undefined && v > 0) body[f.key] = INTS.has(f.key) ? Math.round(v) : v;
      }
      return apiFetch("/api/body-metrics", { method: "PUT", json: body });
    },
    onSuccess: () => {
      setValues({});
      return qc.invalidateQueries({ queryKey: queryKeys.progress });
    },
  });
  const hasValue = Object.values(values).some((v) => v !== undefined && v > 0);
  const bp = data?.bloodPressure;

  return (
    <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <Ruler className="w-5 h-5 text-brand-600" />
        <h3 className="font-bold text-slate-900 text-base">Vücut ölçüleri ve sağlık</h3>
      </div>

      {data && (
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SHOWN.filter((k) => data.latest[k]).map((k) => {
            const f = FIELDS.find((x) => x.key === k)!;
            const change = data.changes[k];
            return (
              <li key={k} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-500">{f.label}</p>
                <p className="text-lg font-extrabold text-slate-900">
                  {formatNumberTr(data.latest[k]!.value)} {f.unit}
                </p>
                <p className="text-[11px] text-slate-500">
                  {formatDateTr(data.latest[k]!.date, { short: true })}
                  {change && (
                    <>
                      {" · "}
                      <span className="font-semibold">{signed(change.delta)}</span>
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {data?.waistToHeight && (
        <p className={`text-xs ${data.waistToHeight.elevated ? "text-amber-800" : "text-slate-600"}`}>
          Bel/boy oranı {data.waistToHeight.ratio.toFixed(2).replace(".", ",")}
          {data.waistToHeight.elevated ? ": 0,5'in üstünde. Bel çevresini azaltmak sağlık açısından yararlı." : ": 0,5'in altında."}
        </p>
      )}
      {bp && (
        <div role={bp.level === "normal" ? "status" : "alert"} className={`p-3 rounded-xl border text-xs ${BP_TONE[bp.level]}`}>
          <p className="font-bold">
            Tansiyon {bp.systolic}/{bp.diastolic} mmHg · {formatDateTr(bp.date, { short: true })}
          </p>
          <p>{bp.message}</p>
        </div>
      )}

      <div className="pt-3 border-t border-slate-100 space-y-2">
        <div className="max-w-[12rem]">
          <label htmlFor="bm-date" className="block text-xs font-semibold text-slate-600 mb-1">
            Tarih
          </label>
          <input id="bm-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={`bm-${f.key}`} className="block text-[11px] font-semibold text-slate-600 mb-1">
                {f.input}
              </label>
              <DecimalInput
                id={`bm-${f.key}`}
                value={values[f.key]}
                onValueChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={!hasValue || save.isPending}
          onClick={() => save.mutate()}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50"
        >
          Ölçüleri kaydet
        </button>
        {save.isError && (
          <p role="alert" className="text-xs text-rose-700">
            {errorMessage(save.error, "Ölçü kaydedilemedi.")}
          </p>
        )}
        <p className="text-[11px] text-slate-500">Yalnız doldurduğun alanlar kaydedilir; aynı güne ait diğer ölçüler korunur.</p>
      </div>
    </section>
  );
}
