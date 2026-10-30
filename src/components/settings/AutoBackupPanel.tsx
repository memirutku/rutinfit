"use client";

import { useState } from "react";
import { FolderSearch } from "lucide-react";
import { errorMessage } from "@/lib/client/api";
import { useTimedMessage } from "@/hooks/useTimedMessage";
import { useAutoBackup, useRunAutoBackup, useSaveAutoBackup, type AutoBackupInput } from "@/lib/client/queries/auto-backup";
import { useChooseFolder } from "@/lib/client/queries/local-files";
import { PathActions } from "@/components/ui/PathActions";

const LABEL = "block text-xs font-semibold text-slate-600 mb-1";
const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";

/** Kaydedilen değer bekleyen istekte iyimser gösterilir; hata olursa sorgudaki değere döner. */
function useAutoBackupSaver() {
  const saved = useAutoBackup();
  const save = useSaveAutoBackup();
  const done = useTimedMessage<string>(2500);
  const pending = save.isPending ? save.variables : undefined;
  const commit = (input: AutoBackupInput, where: string) => {
    done.clear();
    save.mutate(input, { onSuccess: () => done.show(where) });
  };
  return { saved, save, pending, commit, done };
}

function SavedNote({ show }: { show: boolean }) {
  return show ? (
    <span role="status" className="text-[11px] font-semibold text-emerald-700">
      Kaydedildi ✓
    </span>
  ) : null;
}

/** F61: Seçilen klasöre günlük ya da haftalık otomatik yedek. B34: her ayar dokununca kaydedilir. */
export function AutoBackupPanel() {
  const { saved, save, pending, commit, done } = useAutoBackupSaver();
  const run = useRunAutoBackup();
  const pick = useChooseFolder();
  const data = saved.data;
  const [folder, setFolder] = useState(data?.folderPath ?? "");
  const [seededFrom, setSeededFrom] = useState(data?.folderPath);
  if (data?.folderPath !== seededFrom) {
    setSeededFrom(data?.folderPath);
    setFolder(data?.folderPath ?? "");
  }
  const enabled = pending?.enabled ?? data?.enabled ?? false;
  const frequency = pending?.frequency ?? data?.frequency ?? "daily";
  const last = data?.lastRunAt ? new Date(data.lastRunAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : null;
  const error = save.error ?? run.error ?? pick.error;

  function toggle(on: boolean) {
    // Klasör seçilmemişse önerilen klasör kullanılır (sunucu oluşturur).
    commit(on ? { enabled: true, folderPath: data?.folderPath ?? (folder.trim() || data?.suggestedFolder || null) } : { enabled: false }, "enabled");
  }

  function commitFolder() {
    const value = folder.trim() || null;
    if (value !== (data?.folderPath ?? null)) commit({ folderPath: value }, "folder");
  }

  // B36: macOS'un klasör seçme penceresi; seçilen klasör hemen kaydedilir.
  function chooseFolder() {
    pick.mutate(undefined, {
      onSuccess: ({ path }) => {
        if (path) commit({ folderPath: path }, "folder");
      },
    });
  }

  return (
    <div className="pt-3 border-t border-slate-100 space-y-3">
      <div>
        <p className="text-xs font-bold text-slate-700">Otomatik yedek</p>
        <p className="text-[11px] text-slate-500">
          Uygulama açıkken seçtiğin klasöre düzenli yedek alır. iCloud Drive ya da Syncthing klasörü seçersen yedeklerin diğer
          cihazlarına da ulaşır.
        </p>
      </div>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
        <input id="auto-backup-enabled" type="checkbox" checked={enabled} disabled={save.isPending} onChange={(e) => toggle(e.target.checked)} />
        Otomatik yedek açık
        <SavedNote show={done.message === "enabled"} />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 min-w-0">
          <div className="flex items-center gap-2">
            <label htmlFor="auto-backup-folder" className={LABEL}>
              Yedek klasörü
            </label>
            <SavedNote show={done.message === "folder"} />
          </div>
          <div className="flex gap-2">
            <input
              id="auto-backup-folder"
              type="text"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              onBlur={commitFolder}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitFolder();
              }}
              className={`${INPUT} min-w-0`}
            />
            <button
              id="auto-backup-choose"
              type="button"
              disabled={pick.isPending || save.isPending}
              onClick={chooseFolder}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50"
            >
              <FolderSearch className="w-3.5 h-3.5" aria-hidden />
              Klasör seç…
            </button>
          </div>
          {!data?.folderPath && data?.suggestedFolder && (
            <p className="mt-1 text-[11px] text-slate-500 break-all">Önerilen: {data.suggestedFolder} (henüz seçilmedi)</p>
          )}
          {data?.folderPath && (
            <div className="mt-1">
              <PathActions
                target={{ path: data.folderPath }}
                revealLabel="Yedek klasörünü Finder'da göster"
                copy={{ text: data.folderPath, label: "Yedek klasörünün yolunu kopyala" }}
              />
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <label htmlFor="auto-backup-frequency" className={LABEL}>
              Sıklık
            </label>
            <SavedNote show={done.message === "frequency"} />
          </div>
          <select
            id="auto-backup-frequency"
            value={frequency}
            disabled={save.isPending}
            onChange={(e) => commit({ frequency: e.target.value as "daily" | "weekly" }, "frequency")}
            className={INPUT}
          >
            <option value="daily">Günlük</option>
            <option value="weekly">Haftalık</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          id="auto-backup-run"
          type="button"
          disabled={run.isPending || !data?.folderPath}
          onClick={() => run.mutate()}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 disabled:opacity-50"
        >
          Şimdi yedekle
        </button>
      </div>
      {run.data && (
        <p role={run.data.ok ? "status" : "alert"} className={`text-xs ${run.data.ok ? "text-emerald-800" : "text-rose-700"} break-all`}>
          {run.data.message} {run.data.file}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-rose-700">
          {errorMessage(error, "İşlem yapılamadı.")}
        </p>
      )}
      {last && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] text-slate-500 break-all">
            Son yedek: {last} · {data?.lastStatus === "ok" ? data.lastFile : `Hata: ${data?.lastMessage}`}
          </p>
          {data?.lastStatus === "ok" && data.lastFile && (
            <PathActions
              target={{ path: data.lastFile }}
              revealLabel="Son otomatik yedeği Finder'da göster"
              copy={{ text: data.lastFile, label: "Son otomatik yedeğin yolunu kopyala" }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** B34/B36: yedeğin teknik ayrıntıları (Gelişmiş altında): saklama sayısı ve dışa aktarma kopyası. */
export function BackupDetailsPanel() {
  const { saved, save, pending, commit, done } = useAutoBackupSaver();
  const data = saved.data;
  const [keep, setKeep] = useState(String(data?.keepCount ?? 10));
  const [seededFrom, setSeededFrom] = useState(data?.keepCount);
  if (data?.keepCount !== seededFrom) {
    setSeededFrom(data?.keepCount);
    setKeep(String(data?.keepCount ?? 10));
  }
  const exportCopies = pending?.exportCopies ?? data?.exportCopies ?? true;

  function commitKeep() {
    const n = Math.max(1, Math.min(100, parseInt(keep, 10) || 1));
    setKeep(String(n));
    if (n !== data?.keepCount) commit({ keepCount: n }, "keep");
  }

  return (
    <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <h3 className="font-bold text-slate-900 text-base">Yedek ayrıntıları</h3>
      <label className="flex items-start gap-2 text-xs text-slate-700">
        <input
          id="export-copies"
          type="checkbox"
          className="mt-0.5"
          checked={exportCopies}
          disabled={save.isPending || !data}
          onChange={(e) => commit({ exportCopies: e.target.checked }, "copies")}
        />
        <span>
          <span className="font-bold">Dışa aktarırken uygulama klasörüne de kopya kaydet</span> <SavedNote show={done.message === "copies"} />
          <span className="block text-slate-500">
            Varsayılan olarak açık. Yedek, CSV ve rapor indirilirken bir kopyası uygulamanın veri klasörüne (backups ve exports)
            yazılır; masaüstünde indirme engellenirse dosya kaybolmaz. Kapatırsan dosyalar yalnız İndirilenler klasörüne iner.
          </span>
        </span>
      </label>
      <div className="max-w-xs">
        <div className="flex items-center gap-2">
          <label htmlFor="auto-backup-keep" className={LABEL}>
            Saklanacak otomatik yedek sayısı
          </label>
          <SavedNote show={done.message === "keep"} />
        </div>
        <input
          id="auto-backup-keep"
          type="number"
          min={1}
          max={100}
          value={keep}
          onChange={(e) => setKeep(e.target.value)}
          onBlur={commitKeep}
          className={INPUT}
        />
        <p className="mt-1 text-[11px] text-slate-500">Sayı aşılınca en eski otomatik yedek silinir. Klasördeki başka dosyalara dokunulmaz.</p>
      </div>
      {save.error && (
        <p role="alert" className="text-xs text-rose-700">
          {errorMessage(save.error, "Kaydedilemedi.")}
        </p>
      )}
    </section>
  );
}
