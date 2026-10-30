"use client";

import { Database, RefreshCw } from "lucide-react";
import { useDiagnostics } from "@/lib/client/queries/system";
import type { Diagnostics } from "@/lib/schemas/system";

const COUNT_ROWS: Array<{ key: keyof Diagnostics["counts"]; label: string }> = [
  { key: "foods", label: "Besinler:" },
  { key: "foodLogs", label: "Öğün Kayıtları:" },
  { key: "workoutSessions", label: "Antrenmanlar:" },
  { key: "setLogs", label: "Set Kayıtları:" },
  { key: "pantryItems", label: "Kiler Ürünleri:" },
  { key: "weightLogs", label: "Tartı Kayıtları:" },
  { key: "mealPlans", label: "Yemek Planları:" },
  { key: "recipes", label: "Tarifler:" },
];

const fileName = (path: string) => path.split("/").pop();

/** Veritabanı boyutu, yedek klasörü, çalışma ortamı ve tablo kayıt sayıları. */
export function DiagnosticsSection() {
  const query = useDiagnostics();
  const diagnostics = query.data;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-slate-900 text-base">Sistem Tanılama & Depolama Sağlığı 🩺</h3>
        </div>
        <button
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
          <span>Yenile</span>
        </button>
      </div>

      {diagnostics ? (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">SQLite Veritabanı</span>
              <span className="font-mono font-bold text-slate-800 mt-0.5 block truncate" title={diagnostics.storage.dbPath}>
                {fileName(diagnostics.storage.dbPath)}
              </span>
              <p className="text-[11px] text-emerald-600 font-bold mt-1">Boyut: {diagnostics.storage.dbSizeFormatted}</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">Yedek Klasörü</span>
              <span className="font-mono font-bold text-slate-800 mt-0.5 block truncate" title={diagnostics.storage.backupsDir}>
                {fileName(diagnostics.storage.backupsDir)}
              </span>
              <p className="text-[11px] text-slate-600 mt-1">
                Mevcut Yedekler: <strong>{diagnostics.storage.backupCount || 0} adet</strong>
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">Çalışma Ortamı</span>
              <span className="font-bold text-slate-800 mt-0.5 block">
                Node {diagnostics.system.nodeVersion} ({diagnostics.system.platform}-{diagnostics.system.arch})
              </span>
              <p className="text-[11px] text-slate-600 mt-1">
                RAM Tüketimi: <strong>{diagnostics.system.memoryRssMb} MB</strong>
              </p>
            </div>
          </div>

          <div>
            <span className="font-bold text-slate-700 block mb-2">Veritabanı Tablo Kayıt Dağılımı:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {COUNT_ROWS.map(({ key, label }) => (
                <div key={key} className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-bold text-slate-900">{diagnostics.counts[key] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400">Tanılama bilgileri yükleniyor...</p>
      )}
    </div>
  );
}
