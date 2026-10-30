"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardCopy, Database, RefreshCw } from "lucide-react";
import { copyText } from "@/lib/client/clipboard";
import { queryKeys } from "@/lib/client/queries/keys";
import { useDiagnostics } from "@/lib/client/queries/system";
import { formatNumberTr } from "@/lib/format";
import type { Diagnostics } from "@/lib/schemas/system";
import { PathActions } from "@/components/ui/PathActions";

/** B38: bölüm açıkken tanılama bu aralıkla kendiliğinden yenilenir. */
const REFRESH_MS = 30_000;

interface PathRow {
  key: string;
  label: string;
  path: string | null;
  detail?: string | null;
  reveal: string;
  copy: string;
}

function pathRows(d: Diagnostics): PathRow[] {
  const s = d.storage;
  return [
    { key: "db", label: "Veritabanı", path: s.dbPath, detail: `Boyut: ${s.dbSizeFormatted}`, reveal: "Veritabanı dosyasını Finder'da göster", copy: "Veritabanı dosyasının yolunu kopyala" },
    {
      key: "backups",
      label: "Uygulama yedekleri",
      path: s.backupsDir,
      detail: `Uygulama klasöründe: ${formatNumberTr(s.backupCount)} yedek`,
      reveal: "Uygulama yedek klasörünü Finder'da göster",
      copy: "Uygulama yedek klasörünün yolunu kopyala",
    },
    {
      key: "auto",
      label: "Otomatik yedek klasörü",
      path: s.autoBackupFolder,
      detail: s.autoBackupFolder ? `Otomatik yedek klasöründe: ${formatNumberTr(s.autoBackupCount)} yedek` : "Seçilmedi",
      reveal: "Otomatik yedek klasörünü Finder'da göster",
      copy: "Otomatik yedek klasörünün yolunu kopyala",
    },
    { key: "exports", label: "Dışa aktarma kopyaları", path: s.exportsDir, reveal: "Dışa aktarma klasörünü Finder'da göster", copy: "Dışa aktarma klasörünün yolunu kopyala" },
    { key: "uploads", label: "Fotoğraflar ve yüklenen dosyalar", path: s.uploadsDir, reveal: "Yükleme klasörünü Finder'da göster", copy: "Yükleme klasörünün yolunu kopyala" },
    {
      key: "log",
      label: "Günlük dosyası",
      path: d.system.logFile,
      detail: d.system.logFileExists ? null : "Henüz yok; yalnız masaüstü uygulaması yazar.",
      reveal: "Günlük dosyasını Finder'da göster",
      copy: "Günlük dosyasının yolunu kopyala",
    },
  ];
}

/** B38: destek isteğine yapıştırılacak düz metin. Kişisel kayıt içermez; yalnız sayılar ve yollar. */
export function diagnosticsText(d: Diagnostics): string {
  const s = d.storage;
  return [
    `RutinFit ${d.system.appVersion ?? "?"}`,
    `Oluşturma: ${d.generatedAt}`,
    `Ortam: Node ${d.system.nodeVersion} (${d.system.platform}-${d.system.arch}), RAM ${d.system.memoryRssMb} MB`,
    `Veritabanı: ${s.dbPath} (${s.dbSizeFormatted})`,
    `Veri klasörü: ${s.dataDir}`,
    `Uygulama yedekleri: ${s.backupsDir} (${s.backupCount} yedek)`,
    `Otomatik yedek klasörü: ${s.autoBackupFolder ? `${s.autoBackupFolder} (${s.autoBackupCount} yedek)` : "seçilmedi"}`,
    `Dışa aktarma kopyaları: ${s.exportsDir}`,
    `Yüklemeler: ${s.uploadsDir}`,
    `Günlük dosyası: ${d.system.logFile}${d.system.logFileExists ? "" : " (yok)"}`,
    "",
    "Tablolar:",
    ...d.tables.map((t) => `${t.label}: ${t.count}`),
  ].join("\n");
}

/** Veritabanı, yedek klasörleri, sürüm, günlük dosyası ve bütün tabloların kayıt sayıları. */
export function DiagnosticsSection() {
  const query = useDiagnostics({ refetchInterval: REFRESH_MS });
  const diagnostics = query.data;
  const qc = useQueryClient();
  const [copied, setCopied] = useState<boolean | null>(null);

  // B38: herhangi bir işlem (kayıt, yedek, geri yükleme) bitince tanılama tazelenir.
  useEffect(
    () =>
      qc.getMutationCache().subscribe((event) => {
        if (event.type === "updated" && (event.action.type === "success" || event.action.type === "error")) {
          void qc.invalidateQueries({ queryKey: queryKeys.diagnostics });
        }
      }),
    [qc]
  );

  async function copyAll() {
    if (diagnostics) setCopied(await copyText(diagnosticsText(diagnostics)));
  }

  const updated = diagnostics ? new Date(diagnostics.generatedAt).toLocaleTimeString("tr-TR") : null;

  return (
    <section className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Database className="w-5 h-5 text-indigo-600 shrink-0" />
          <h3 className="font-bold text-slate-900 text-base">Sistem Tanılama ve Depolama</h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={copyAll}
            disabled={!diagnostics}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 disabled:opacity-50"
          >
            <ClipboardCopy className="w-3.5 h-3.5" aria-hidden />
            <span>Tanılamayı kopyala</span>
          </button>
          <button
            type="button"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${query.isFetching ? "animate-spin" : ""}`} aria-hidden />
            <span>Yenile</span>
          </button>
        </div>
      </div>
      {copied === true && (
        <p role="status" className="text-xs font-semibold text-emerald-700">
          Tanılama kopyalandı
        </p>
      )}
      {copied === false && (
        <p role="alert" className="text-xs font-semibold text-rose-700">
          Panoya kopyalanamadı.
        </p>
      )}

      {diagnostics ? (
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-bold text-slate-900">{`RutinFit ${diagnostics.system.appVersion ?? "?"}`}</span>
            <span className="text-slate-600">{`Node ${diagnostics.system.nodeVersion} (${diagnostics.system.platform}-${diagnostics.system.arch})`}</span>
            <span className="text-slate-600">{`RAM: ${formatNumberTr(diagnostics.system.memoryRssMb)} MB`}</span>
            {updated && <span className="text-slate-400">{`Son güncelleme ${updated} · ${REFRESH_MS / 1000} sn'de bir yenilenir`}</span>}
          </div>

          <ul className="space-y-2">
            {pathRows(diagnostics).map((row) => (
              <li key={row.key} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 min-w-0">
                <span className="text-slate-500 font-semibold block text-[11px]">{row.label}</span>
                {row.path ? <span className="font-mono text-slate-800 block break-all">{row.path}</span> : null}
                {row.detail && <span className="text-[11px] text-slate-600 block">{row.detail}</span>}
                {row.path && <PathActions target={{ path: row.path }} revealLabel={row.reveal} copy={{ text: row.path, label: row.copy }} />}
              </li>
            ))}
          </ul>

          <div>
            <span className="font-bold text-slate-700 block mb-2">Tablolardaki kayıt sayıları</span>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 gap-2">
              {diagnostics.tables.map((t) => (
                <div key={t.model} className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-100 flex items-center justify-between gap-2" title={t.model}>
                  <span className="text-slate-600 min-w-0">{t.label}</span>
                  <span className="font-bold text-slate-900">{formatNumberTr(t.count)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400">{query.isError ? "Tanılama bilgileri alınamadı." : "Tanılama bilgileri yükleniyor..."}</p>
      )}
    </section>
  );
}
