"use client";

import {
  Scale,
  BatteryMedium,
  Info,
  CheckCircle2,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { useProgress } from "@/lib/client/queries/progress";
import { formatDateTr } from "@/lib/format";
import { StrengthSection } from "@/components/progress/StrengthSection";
import { AdaptiveTdeeCard } from "@/components/progress/AdaptiveTdeeCard";
import { CheckinCard } from "@/components/progress/CheckinCard";
import { VolumeSection } from "@/components/progress/VolumeSection";

export default function ProgressPage() {
  const { data, isPending } = useProgress();

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm">İlerleme verileri yükleniyor...</p>
      </div>
    );
  }

  const weights = data?.weights || [];
  const wellbeings = data?.wellbeings || [];
  const creatineList = data?.creatineCompliance || [];

  // Enerji & Uyku Grafiği için verileri birleştir
  const energySleepChartData = wellbeings.map((w) => ({
    date: formatDateTr(w.date, { short: true }), // gg.aa
    enerji: w.energy1to5,
    uykuSaat: w.sleepMinutes ? Math.round((w.sleepMinutes / 60) * 10) / 10 : 7,
  }));

  const weightChartData = weights.map((w) => ({
    date: formatDateTr(w.date, { short: true }), // gg.aa
    gunlukKilo: w.weightKg,
    haftalikOrtalama: w.rollingAvg,
  }));

  return (
    <div className="space-y-6">
      {/* Üst Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            İlerleme & Vücut Trendleri 📈
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Günlük dalgalanmalar yerine 7 günlük ortalamalar ve toparlanma eğilimi.
          </p>
        </div>
      </div>

      {/* Kreatin ve Kilo Dalgalanması Bilgilendirme Kartı */}
      <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <p className="font-bold mb-0.5">
            Kreatin ve Günlük Tartı Dalgalanmaları Hakkında Önemli Not:
          </p>
          <p>
            Kreatin takviyesine başlandığında kas hücrelerinin su tutma kapasitesi artar.
            Bu durum ilk 2–3 haftada tartıda 1–2 kg artışa yol açabilir; bu kesinlikle
            yağ artışı değildir. Bu nedenle RutinFit tekil gün tartısına değil,
            <strong> 7 günlük hareketli ortalamaya</strong> odaklanır.
          </p>
        </div>
      </div>

      {/* Özet Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>HAFTALIK KİLO FARKI</span>
            <Scale className="w-4 h-4 text-brand-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {data && data.weeklyWeightDelta > 0 ? `+${data.weeklyWeightDelta}` : data?.weeklyWeightDelta || "0"} kg
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Önceki haftanın 7 günlük ortalamasına göre değişim
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>SON 7 GÜN KREATİN UYUMU</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {creatineList.filter((c) => c.taken).length} / 7 Gün
          </div>
          <div className="flex gap-1.5 mt-2">
            {creatineList.map((c) => (
              <span
                key={c.date}
                title={`${formatDateTr(c.date)}: ${c.taken ? "Alındı" : "Alınmadı"}`}
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  c.taken
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 text-slate-400"
                }`}
              >
                {c.taken ? "✓" : "–"}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>ORTALAMA ENERJİ</span>
            <BatteryMedium className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {wellbeings.length > 0
              ? (
                  wellbeings.reduce((a, b) => a + b.energy1to5, 0) /
                  wellbeings.length
                ).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
              : "3,0"}{" "}
            / 5
          </div>
          <p className="text-xs text-slate-400 mt-1">
            İş ve toparlanma dengesi göstergesi
          </p>
        </div>
      </div>

      {/* 1. GRAFİK: 7 Günlük Hareketli Kilo Ortalaması */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base">
            Kilo Eğilimi (Günlük Tartı vs 7 Günlük Ortalama)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Düz çizgi (yeşil): 7 günlük hareketli ortalama · Kesikli çizgi (mavi): günlük tartı
          </p>
        </div>

        <div className="h-72 w-full">
          {weightChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "none",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="gunlukKilo"
                  name="Günlük Tartı (kg)"
                  stroke="#38bdf8"
                  strokeDasharray="4 4"
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="haftalikOrtalama"
                  name="7 Günlük Ortalama (kg)"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Grafik için henüz yeterli kilo kaydı yok.
            </div>
          )}
        </div>
      </div>

      {/* 2. GRAFİK: Enerji ve Uyku İlişkisi */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base">
            Enerji (1-5) ve Uyku Süresi (Saat)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            7+ saat uyku toparlanmayı ve iş çıkışı antrenman motivasyonunu destekler.
          </p>
        </div>

        <div className="h-72 w-full">
          {energySleepChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={energySleepChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  domain={[0, 10]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "none",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="enerji"
                  name="Enerji Seviyesi (1-5)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="uykuSaat"
                  name="Uyku Süresi (saat)"
                  stroke="#6366f1"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Grafik için henüz enerji ve uyku kaydı yok.
            </div>
          )}
        </div>
      </div>

      {/* F49: Haftalık değerlendirme */}
      <CheckinCard />

      {/* F10: Gerçek harcama tahmini (adaptif TDEE) */}
      <AdaptiveTdeeCard />

      {/* F23: Güç gelişimi ve rekorlar */}
      <StrengthSection />

      {/* F24: Kas grubu başına haftalık set */}
      <VolumeSection />
    </div>
  );
}
