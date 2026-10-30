"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/client/api";
import { useAutoBackup, useRunAutoBackup, useSaveAutoBackup, type AutoBackupInput, type AutoBackupView } from "@/lib/client/queries/auto-backup";

const LABEL = "block text-xs font-semibold text-slate-600 mb-1";
const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";

const toForm = (v: AutoBackupView | undefined): AutoBackupInput => ({
  enabled: v?.enabled ?? false,
  folderPath: v?.folderPath ?? null,
  frequency: v?.frequency ?? "daily",
  keepCount: v?.keepCount ?? 10,
});

/** F61: Seçilen klasöre günlük ya da haftalık otomatik yedek. */
export function AutoBackupPanel() {
  const saved = useAutoBackup();
  const save = useSaveAutoBackup();
  const run = useRunAutoBackup();
  const [form, setForm] = useState<AutoBackupInput>(() => toForm(saved.data));
  const [seededFrom, setSeededFrom] = useState(saved.data);
  if (saved.data !== seededFrom) {
    setSeededFrom(saved.data);
    setForm(toForm(saved.data));
  }
  const set = <K extends keyof AutoBackupInput>(k: K, v: AutoBackupInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const last = saved.data?.lastRunAt ? new Date(saved.data.lastRunAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : null;
  const error = save.error ?? run.error;

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
        <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} />
        Otomatik yedek açık
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2">
          <label htmlFor="auto-backup-folder" className={LABEL}>
            Yedek klasörü
          </label>
          <input
            id="auto-backup-folder"
            type="text"
            value={form.folderPath ?? ""}
            placeholder={saved.data?.suggestedFolder}
            onChange={(e) => set("folderPath", e.target.value || null)}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="auto-backup-frequency" className={LABEL}>
            Sıklık
          </label>
          <select
            id="auto-backup-frequency"
            value={form.frequency}
            onChange={(e) => set("frequency", e.target.value as AutoBackupInput["frequency"])}
            className={INPUT}
          >
            <option value="daily">Günlük</option>
            <option value="weekly">Haftalık</option>
          </select>
        </div>
        <div>
          <label htmlFor="auto-backup-keep" className={LABEL}>
            Saklanacak yedek sayısı
          </label>
          <input
            id="auto-backup-keep"
            type="number"
            min={1}
            max={100}
            value={form.keepCount}
            onChange={(e) => set("keepCount", Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))}
            className={INPUT}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={save.isPending}
          onClick={() =>
            save.mutate({
              ...form,
              // Klasör boşsa önerilen klasör kullanılır.
              folderPath: form.folderPath ?? (form.enabled ? saved.data?.suggestedFolder ?? null : null),
            })
          }
          className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50"
        >
          Otomatik yedeği kaydet
        </button>
        <button
          type="button"
          disabled={run.isPending || !saved.data?.folderPath}
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
        <p className="text-[11px] text-slate-500 break-all">
          Son yedek: {last} · {saved.data?.lastStatus === "ok" ? saved.data.lastFile : `Hata: ${saved.data?.lastMessage}`}
        </p>
      )}
    </div>
  );
}
