"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { errorMessage } from "@/lib/client/api";
import { useDeleteWorkout, useWorkoutHistory } from "@/lib/client/queries/workouts";
import { addDaysToDateString } from "@/lib/date-utils";
import { formatDateTr, formatDecimalTr } from "@/lib/format";
import type { WorkoutSession } from "@/lib/schemas/workout";
import { isWorkingSet } from "@/lib/set-types";
import { EditSessionModal } from "./EditSessionModal";
import { groupSetLogs, sessionLabel, sessionVolume } from "./session-history";
import { dayNameOf } from "./WeeklyPlanGrid";

const PAGE = 20;

function relativeDay(date: string, today: string): string | null {
  if (date === today) return "Bugün";
  if (date === addDaysToDateString(today, -1)) return "Dün";
  return null;
}

/** B19: Tarihli seans geçmişi: setleri gör, düzenle, onayla sil. */
export function SessionHistory({ today }: { today: string }) {
  const [limit, setLimit] = useState(PAGE);
  const history = useWorkoutHistory(limit);
  const remove = useDeleteWorkout();
  const { confirm, dialog } = useConfirm();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<WorkoutSession | null>(null);
  const sessions = history.data ?? [];

  async function askDelete(s: WorkoutSession) {
    const ok = await confirm({
      title: "Seans silinsin mi?",
      message: `${formatDateTr(s.date)} tarihli “${s.name}” seansı ve ${s.setLogs.length} seti kalıcı olarak silinecek.`,
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (ok) remove.mutate(s.id);
  }

  return (
    <section id="gecmis" aria-labelledby="session-history-title" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <History className="w-5 h-5 text-brand-600" />
        <h3 id="session-history-title" className="font-bold text-slate-900 text-base">
          Seans geçmişi
        </h3>
      </div>

      {history.isPending && (
        <p role="status" className="text-sm text-slate-500">
          Seanslar yükleniyor...
        </p>
      )}
      {history.isError && (
        <p role="alert" className="text-sm text-rose-700">
          {errorMessage(history.error, "Seans geçmişi yüklenemedi.")}
        </p>
      )}
      {remove.isError && (
        <p role="alert" className="text-sm text-rose-700">
          {errorMessage(remove.error, "Seans silinemedi.")}
        </p>
      )}
      {history.isSuccess && sessions.length === 0 && (
        <p className="text-sm text-slate-500">Henüz kaydedilmiş seans yok. Bir seansı bitirdiğinde ya da metinden eklediğinde burada görünür.</p>
      )}

      {sessions.length > 0 && (
        <ul aria-label="Seans geçmişi" className="divide-y divide-slate-100">
          {sessions.map((s) => {
            const label = sessionLabel(s);
            const rel = relativeDay(s.date, today);
            const open = openId === s.id;
            return (
              <li key={s.id} className="py-3 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-500">
                      {formatDateTr(s.date)} · {dayNameOf(s.date)}
                      {rel && <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-700">{rel}</span>}
                    </p>
                    <p className="font-bold text-slate-900 text-sm truncate">{s.name}</p>
                    <p className="text-xs text-slate-500">
                      {s.setLogs.length} set · {formatDecimalTr(sessionVolume(s))} kg · {s.durationMinutes} dk
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      aria-label={`${label} setlerini gör`}
                      aria-expanded={open}
                      onClick={() => setOpenId(open ? null : s.id)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {open ? "Gizle" : "Gör"}
                    </button>
                    <button
                      type="button"
                      aria-label={`${label} seansını düzenle`}
                      onClick={() => setEditing(s)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      aria-label={`${label} seansını sil`}
                      disabled={remove.isPending}
                      onClick={() => askDelete(s)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      Sil
                    </button>
                  </div>
                </div>
                {open && (
                  <ul aria-label={`${label} setleri`} className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 space-y-1">
                    {groupSetLogs(s.setLogs).map((g) => (
                      <li key={g.exerciseName}>
                        <span className="font-semibold text-slate-800">{g.exerciseName}</span>:{" "}
                        {g.sets
                          .map((x) => `${formatDecimalTr(x.weightKg)} kg × ${x.reps}${isWorkingSet(x.setType) ? "" : " (ısınma)"}`)
                          .join(", ")}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {sessions.length === limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PAGE)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          Daha fazla göster
        </button>
      )}

      <EditSessionModal session={editing} today={today} onClose={() => setEditing(null)} />
      {dialog}
    </section>
  );
}
