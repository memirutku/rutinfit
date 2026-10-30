"use client";

import { useState } from "react";
import { AlertCircle, Check, Download } from "lucide-react";
import { ApiError, errorMessage } from "@/lib/client/api";
import { useImportBackup } from "@/lib/client/queries/system";
import type { ConfirmOptions } from "@/components/ui/ConfirmDialog";
import { AutoBackupPanel } from "./AutoBackupPanel";
import { downloadFile } from "@/lib/client/download";
import { useAutoBackup } from "@/lib/client/queries/auto-backup";
import { queryKeys } from "@/lib/client/queries/keys";
import { useQueryClient } from "@tanstack/react-query";
import { PathActions } from "@/components/ui/PathActions";
import { FilePicker } from "@/components/ui/FilePicker";

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

/** B36: indirilen dosyanın adı ve (ayar açıksa) uygulama klasöründeki kopyanın yolu. */
type ExportResult = { ok: true; what: string; name: string; savedPath: string | null } | { ok: false; message: string };

async function downloadBackup(): Promise<ExportResult> {
  const { name, savedPath } = await downloadFile("/api/backup/export", "rutinfit-backup.json", "X-RutinFit-Backup-Path");
  return { ok: true, what: "Yedek", name, savedPath };
}

/** F60: diğer uygulamalarda ve tablolama programlarında açılabilen CSV dosyaları. */
const CSV_EXPORTS = [
  { type: "food-log", label: "Besin günlüğü (CSV)" },
  { type: "workouts", label: "Antrenmanlar (CSV, Strong biçimi)" },
  { type: "body", label: "Kilo ve bel ölçüsü (CSV)" },
] as const;

async function downloadCsv(type: string): Promise<ExportResult> {
  const { name, savedPath } = await downloadFile(`/api/export/csv?type=${type}`, `rutinfit-${type}.csv`, "X-RutinFit-Export-Path");
  return { ok: true, what: "CSV", name, savedPath };
}

/** B36: dosyanın nereye indiği; Finder'da göster ve kopyanın yolunu kopyala. */
function ExportResultView({ result }: { result: ExportResult }) {
  if (!result.ok) {
    return (
      <p role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 [overflow-wrap:anywhere]">
        {result.message}
      </p>
    );
  }
  return (
    <div role="status" className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold [overflow-wrap:anywhere]">{`${result.what} indirildi: ${result.name} (İndirilenler klasörü)`}</p>
        <PathActions target={{ download: result.name }} revealLabel="İndirilen dosyayı Finder'da göster" />
      </div>
      {result.savedPath && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="[overflow-wrap:anywhere] text-slate-600">{`Uygulama klasöründeki kopya: ${result.savedPath}`}</p>
          <PathActions
            target={{ path: result.savedPath }}
            revealLabel="Uygulama klasöründeki kopyayı Finder'da göster"
            copy={{ text: result.savedPath, label: "Uygulama klasöründeki kopyanın yolunu kopyala" }}
          />
        </div>
      )}
    </div>
  );
}

/** Tam veritabanı yedeği: JSON indirme ve onaylı geri yükleme (akıllı birleştirme). */
export function BackupSection({ confirm }: { confirm: (options: ConfirmOptions) => Promise<boolean> }) {
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const exportCopies = useAutoBackup().data?.exportCopies ?? true;
  const qc = useQueryClient();
  // B38: indirme bir işlem (mutation) değildir; uygulama klasörüne kopya düştüğü için tanılama tazelenir.
  const refreshDiagnostics = () => qc.invalidateQueries({ queryKey: queryKeys.diagnostics });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const importBackup = useImportBackup();

  async function handleExport() {
    setExportResult(null);
    try {
      setExportResult(await downloadBackup());
      void refreshDiagnostics();
    } catch (err) {
      setExportResult({ ok: false, message: `Hata: ${errorMessage(err, "Yedek dışa aktarılamadı")}` });
    }
  }

  async function handleCsv(type: string) {
    setExportResult(null);
    try {
      setExportResult(await downloadCsv(type));
      void refreshDiagnostics();
    } catch (err) {
      setExportResult({ ok: false, message: `Hata: ${errorMessage(err, "CSV dışa aktarılamadı")}` });
    }
  }

  // B35: Türkçe dosya seçici girdiyi her seçimden sonra kendisi sıfırlar (aynı dosya yeniden seçilebilir).
  async function handleImport(file: File | undefined) {
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
    if (!ok) return;

    {
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
    }
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Download className="w-5 h-5 text-slate-700" />
        <h3 className="font-bold text-slate-900 text-base">Yedek ve dışa aktarma</h3>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        Besin kataloğun, öğün ve antrenman geçmişin, yemek planların, kilerin ve kilo kayıtların tek bir JSON dosyasına yedeklenir.
        Geri yükleme <strong>birleştirerek</strong> çalışır: mevcut kayıtların silinmez; yedekteki aynı kayıtlar güncellenir, yeniler
        eklenir.
      </p>

      <p className="text-[11px] text-slate-500">
        {exportCopies
          ? "İndirilen her dosyanın bir kopyası uygulama klasörüne de kaydedilir; indirme engellenirse dosya kaybolmaz. Bunu Gelişmiş › Yedek ayrıntıları bölümünden kapatabilirsin."
          : "Uygulama klasörüne kopya kaydı kapalı; dosyalar yalnız İndirilenler klasörüne iner. Gelişmiş › Yedek ayrıntıları bölümünden açabilirsin."}
      </p>

      {exportResult && <ExportResultView result={exportResult} />}

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
          id="backup-export"
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 shadow-xs"
        >
          <Download className="w-4 h-4" />
          <span>Tüm Verileri JSON Olarak İndir</span>
        </button>

      </div>

      <FilePicker
        id="backup-import"
        label="Yedekten geri yükle"
        accept=".json,application/json"
        buttonText={importBackup.isPending ? "Geri yükleniyor..." : "Yedek dosyası seç (JSON)"}
        disabled={importBackup.isPending}
        onFile={handleImport}
      />

      <div className="pt-3 border-t border-slate-100 space-y-2">
        <p className="text-xs font-bold text-slate-700">CSV olarak dışa aktar</p>
        <p className="text-[11px] text-slate-500">
          Excel, Numbers ve diğer uygulamalarda açılır. Antrenman dosyası Strong uygulamasının biçimindedir; RutinFit'e geri
          içe aktarılabilir.
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
