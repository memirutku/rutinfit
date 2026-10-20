"use client";

import { useState } from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Shield,
  Layers,
  Upload,
  Calculator,
  Database,
} from "lucide-react";
import { MuscleHeatmap } from "@/components/MuscleHeatmap";
import { PlateCalculator } from "@/components/PlateCalculator";
import { ApiError, errorMessage } from "@/lib/client/api";
import { useOpenGymStatus, useOpenGymSync } from "@/lib/client/queries/system";
import { useImportWorkoutsCsv } from "@/lib/client/queries/workouts";

interface ResultNotice {
  success: boolean;
  message: string;
  /** CSV ayrıştırma hatalarının ayrıntısı (sunucu gönderirse). */
  details?: unknown;
}

export default function OpenGymPortalPage() {
  const [activeTab, setActiveTab] = useState<
    "heatmap" | "plates" | "importer" | "status"
  >("heatmap");
  const statusQuery = useOpenGymStatus();
  const status = statusQuery.data;
  const loading = statusQuery.isFetching;
  const sync = useOpenGymSync();
  const syncing = sync.isPending;
  const syncResult: ResultNotice | null = sync.isSuccess
    ? sync.data
    : sync.isError
      ? { success: false, message: errorMessage(sync.error, "Senkronizasyon başarısız oldu.") }
      : null;

  // CSV içe aktarma durumu
  const [csvText, setCsvText] = useState("");
  const csvImport = useImportWorkoutsCsv();
  const importing = csvImport.isPending;
  const [importResult, setImportResult] = useState<ResultNotice | null>(null);

  // Senkronizasyon bitince (başarılı ya da değil) durum yeniden kontrol edilir (useOpenGymSync).
  function handleSync() {
    sync.mutate();
  }

  function handleCsvImport() {
    if (!csvText.trim()) return;
    setImportResult(null);
    csvImport.mutate(csvText, {
      onSuccess: (data) => {
        setImportResult({ success: true, message: data.message });
        setCsvText("");
      },
      onError: (err) => {
        const body = err instanceof ApiError ? (err.body as { details?: unknown } | undefined) : undefined;
        setImportResult({
          success: false,
          message: errorMessage(err, "Ayrıştırma hatası"),
          details: body?.details,
        });
      },
    });
  }

  return (
    <div className="space-y-6">
      {/* Üst Başlık & Durum Kartı */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              openGym & Gelişmiş Antrenman Merkezi 🏋️‍♂️
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
              ⚡ Tek Pencere / Yerel-First
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Kas yorgunluk haritası, plaka matematiği, 1RM hesaplayıcı ve Hevy/Strong geçmiş aktarımı tek çatı altında.
          </p>
        </div>

        {/* Tab Seçici */}
        <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab("heatmap")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
              activeTab === "heatmap"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-4 h-4 text-brand-600" />
            <span>Kas Haritası</span>
          </button>

          <button
            onClick={() => setActiveTab("plates")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
              activeTab === "plates"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calculator className="w-4 h-4 text-emerald-600" />
            <span>Plaka & 1RM</span>
          </button>

          <button
            onClick={() => setActiveTab("importer")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
              activeTab === "importer"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Upload className="w-4 h-4 text-amber-600" />
            <span>CSV İçe Aktar</span>
          </button>

          <button
            onClick={() => setActiveTab("status")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
              activeTab === "status"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Database className="w-4 h-4 text-blue-600" />
            <span>Senkronizasyon</span>
          </button>
        </div>
      </div>

      {/* 1. SEKME: KAS HARİTASI */}
      {activeTab === "heatmap" && (
        <div className="space-y-4">
          <MuscleHeatmap />
        </div>
      )}

      {/* 2. SEKME: PLAKA & 1RM HESAPLAYICI */}
      {activeTab === "plates" && (
        <div className="space-y-4">
          <PlateCalculator />
        </div>
      )}

      {/* 3. SEKME: HEVY & STRONG CSV İÇE AKTARICI */}
      {activeTab === "importer" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-lg">
                Hevy, Strong ve CSV Antrenman Geçmişini Aktar 📥
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold border border-slate-200">
                Docker Gerektirmez
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Strong veya Hevy uygulamasından dışa aktardığınız CSV dosyasını yapıştırarak tüm geçmişinizi tek tıkla yerel RutinFit SQLite veritabanına aktarın.
            </p>
          </div>

          {importResult && (
            <div
              className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                importResult.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-rose-50 border-rose-200 text-rose-900"
              }`}
            >
              {importResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{importResult.message}</span>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 block">
              CSV İçeriğini Yapıştırın:
            </label>
            <textarea
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Date,Workout Name,Exercise Name,Set Order,Weight,Reps,RPE..."
              className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              Strong ve Hevy başlık formatları otomatik olarak tanınır.
            </span>

            <button
              onClick={handleCsvImport}
              disabled={importing || !csvText.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 text-xs font-bold transition-colors disabled:opacity-50 shadow-sm"
            >
              <Upload className={`w-4 h-4 ${importing ? "animate-spin" : ""}`} />
              <span>{importing ? "Ayrıştırılıyor..." : "Antrenmanları İçe Aktar"}</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. SEKME: DURUM & SENKRONİZASYON */}
      {activeTab === "status" && (
        <div className="space-y-6">
          {syncResult && (
            <div
              className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                syncResult.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              {syncResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>{syncResult.message}</span>
            </div>
          )}

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
                    status?.isOnline ? "bg-emerald-600" : "bg-slate-400"
                  }`}
                >
                  OG
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    openGym Çevrimdışı / Hibrit Durumu
                  </h3>
                  {loading && (
                    <span role="status" className="text-xs text-slate-500">
                      Bağlantı kontrol ediliyor...
                    </span>
                  )}
                  <p className="text-xs text-slate-500">
                    Yerel depolama: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">./opengym/data</code>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                  <span>{syncing ? "Eşitleniyor..." : "Verileri Eşitle"}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                  openGym Seansları
                </span>
                <span className="text-2xl font-extrabold text-slate-900">
                  {status?.stats?.workoutCount || 0}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Yerel SQLite ile çift yönlü eşitlenir
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                  openGym Tartıları
                </span>
                <span className="text-2xl font-extrabold text-slate-900">
                  {status?.stats?.weightCount || 0}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  RutinFit sabah kilosuyla eşitlenir
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                  Entegre Egzersiz Kataloğu
                </span>
                <span className="text-2xl font-extrabold text-brand-600">
                  5.600+
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Kas haritası ve set rehberi
                </p>
              </div>
            </div>

            <div className="mt-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">
                  Sıfır Dış Port ve İframe'siz Mimari Güvencesi:
                </span>
                <p className="text-emerald-800 mt-0.5 leading-relaxed">
                  RutinFit masaüstü uygulamasında tüm antrenman fonksiyonları yerel React bileşenleri olarak çalışır. Ayrı bir tarayıcı sekmesi açmanıza veya Docker kurmanıza gerek yoktur.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
