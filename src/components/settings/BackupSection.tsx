"use client";

import { useState } from "react";
import { AlertCircle, Check, Download, Upload } from "lucide-react";
import { ApiError, errorMessage } from "@/lib/client/api";
import { useImportBackup } from "@/lib/client/queries/system";
import type { ConfirmOptions } from "@/components/ui/ConfirmDialog";
import { AutoBackupPanel } from "./AutoBackupPanel";

interface ImportResult {
  ok: boolean;
  message: string;
  counts: Record<string, number> | null;
}

const IMPORT_FALLBACK = "Yedek geri yüklenemedi";

/** Sunucu reddederse onun mesajı (ör. "Yedek dosyası geçersiz …"), ağ hatasında anlaşılır metin. */
function importErrorText(error: unknown): string {
  if (error instanceof ApiError && error.status > 0) {
    const body = error.body as { error?: unknown } | undefined;
    return typeof body?.error === "string" ? body.error : IMPORT_FALLBACK;
  }
  return errorMessage(error, IMPORT_FALLBACK);
}

/**
 * Sayfayı JSON adresine götürmek masaüstü görünümünde (WKWebView) dosyayı indirmek yerine
 * ham JSON'u pencerede açıyordu ve geri dönüş yolu yoktu. Yedek blob olarak indirilir.
 */
async function downloadFile(endpoint: string, fallbackName: string, pathHeader: string): Promise<{ name: string; savedPath: string | null }> {
  const res = await fetch(endpoint);
  if (!res.ok) {
    const data: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(data.error || "Dışa aktarılamadı");
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const savedPath = res.headers.get(pathHeader);

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // WebKit indirmeyi başlatmadan adres iptal edilirse indirme düşer; kısa gecikmeyle bırakılır.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { name, savedPath: savedPath ? decodeURIComponent(savedPath) : null };
}

async function downloadBackup(): Promise<string> {
  const { name, savedPath } = await downloadFile("/api/backup/export", "rutinfit-backup.json", "X-RutinFit-Backup-Path");
  return `Yedek indirildi: ${name}.` + (savedPath ? ` Bir kopyası uygulama klasörüne de kaydedildi: ${savedPath}` : "");
}

/** F60: diğer uygulamalarda ve tablolama programlarında açılabilen CSV dosyaları. */
const CSV_EXPORTS = [
  { type: "food-log", label: "Besin günlüğü (CSV)" },
  { type: "workouts", label: "Antrenmanlar (CSV, Strong biçimi)" },
  { type: "body", label: "Kilo ve bel ölçüsü (CSV)" },
] as const;

async function downloadCsv(type: string): Promise<string> {
  const { name, savedPath } = await downloadFile(`/api/export/csv?type=${type}`, `rutinfit-${type}.csv`, "X-RutinFit-Export-Path");
  return `CSV indirildi: ${name}.` + (savedPath ? ` Bir kopyası uygulama klasörüne de kaydedildi: ${savedPath}` : "");
}

/** Tam veritabanı yedeği: JSON indirme ve onaylı geri yükleme (akıllı birleştirme). */
export function BackupSection({ confirm }: { confirm: (options: ConfirmOptions) => Promise<boolean> }) {
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const importBackup = useImportBackup();

  async function handleExport() {
    setExportMessage(null);
    try {
      setExportMessage(await downloadBackup());
    } catch (err) {
      setExportMessage(`Hata: ${errorMessage(err, "Yedek dışa aktarılamadı")}`);
    }
  }

  async function handleCsv(type: string) {
    setExportMessage(null);
    try {
      setExportMessage(await downloadCsv(type));
    } catch (err) {
      setExportMessage(`Hata: ${errorMessage(err, "CSV dışa aktarılamadı")}`);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    // Aynı dosya tekrar seçilebilsin diye input her durumda sıfırlanır.
    const reset = () => {
      input.value = "";
    };
    if (!file) return;

    const ok = await confirm({
      title: "Yedeği geri yükle",
      message: (
        <>
          <strong>{file.name}</strong> geri yüklensin mi? Yedekteki kayıtlar eklenir veya güncellenir; yedekte olmayan mevcut kayıtlarınız
          silinmez.
        </>
      ),
      confirmLabel: "Geri Yükle",
    });
    if (!ok) {
      reset();
      return;
    }

    try {
      let backup: unknown;
      try {
        backup = JSON.parse(await file.text());
      } catch (err) {
        setImportResult({ ok: false, message: `Geçersiz JSON dosyası: ${errorMessage(err, "okunamadı")}`, counts: null });
        return;
      }
      try {
        // Başarılı geri yüklemede bütün önbellek (profil, tanılama dahil) tazelenir.
        const data = await importBackup.mutateAsync(backup);
        setImportResult({ ok: true, message: "Yedek başarıyla geri yüklendi!", counts: data.counts ?? null });
      } catch (err) {
        setImportResult({ ok: false, message: `Hata: ${importErrorText(err)}`, counts: null });
      }
    } finally {
      reset();
    }
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Download className="w-5 h-5 text-slate-700" />
        <h3 className="font-bold text-slate-900 text-base">Yerel Veri Yedekleme & Geri Yükleme</h3>
        <span className="text-[11px] bg-blue-50 text-blue-700 font-semibold px-2.5 py-0.5 rounded-full ml-auto">
          Akıllı Birleştirme (Upsert)
        </span>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        Tüm besin kataloğunuz, antrenman geçmişiniz, yemek planlarınız, kiler envanteriniz ve kilo kayıtlarınız tek bir JSON dosyasında
        yedeklenir. Geri yükleme işlemi <strong>Akıllı Birleştirme (Smart Merge)</strong> prensibiyle çalışır: Mevcut kayıtlarınız
        silinmez; yedekteki aynı kimliğe sahip kayıtlar güncellenir, yeni kayıtlar eklenir.
      </p>

      {exportMessage && (
        <p
          role={exportMessage.startsWith("Hata") ? "alert" : "status"}
          className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 break-all"
        >
          {exportMessage}
        </p>
      )}

      {importResult && (
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div
            role={importResult.ok ? "status" : "alert"}
            className={`text-xs font-bold flex items-center gap-2 ${importResult.ok ? "text-slate-800" : "text-rose-700"}`}
          >
            {importResult.ok ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{importResult.message}</span>
          </div>
          {importResult.counts && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {Object.entries(importResult.counts).map(([table, count]) => (
                <span
                  key={table}
                  className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-md font-semibold text-slate-700"
                >
                  {table}: <strong>{String(count)}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 shadow-xs"
        >
          <Download className="w-4 h-4" />
          <span>Tüm Verileri JSON Olarak İndir</span>
        </button>

        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer border border-slate-200">
          <Upload className="w-4 h-4" />
          <span>{importBackup.isPending ? "Geri yükleniyor..." : "Yedekten Geri Yükle (JSON Seç)"}</span>
          <input type="file" accept=".json" disabled={importBackup.isPending} onChange={handleImport} className="hidden" />
        </label>
      </div>

      <div className="pt-3 border-t border-slate-100 space-y-2">
        <p className="text-xs font-bold text-slate-700">CSV olarak dışa aktar</p>
        <p className="text-[11px] text-slate-500">
          Tablolama programlarında ve diğer uygulamalarda açılır. Antrenman dosyası Strong biçimindedir; RutinFit'e geri içe
          aktarılabilir. Biçimler: docs/CSV_FORMATS.md
        </p>
        <div className="flex flex-wrap gap-2">
          {CSV_EXPORTS.map((c) => (
            <button
              key={c.type}
              type="button"
              onClick={() => handleCsv(c.type)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <AutoBackupPanel />
    </div>
  );
}
