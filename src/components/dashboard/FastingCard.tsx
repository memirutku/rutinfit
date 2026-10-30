"use client";

import { Moon, Timer } from "lucide-react";
import { errorMessage } from "@/lib/client/api";
import { useFasting, useFastingAction } from "@/lib/client/queries/fasting";
import { formatDateTr } from "@/lib/format";

/** B25: ritim kartındaki "Vakitleri gör" bu kartı kaydırır. */
const SECTION_ID = "fasting-section";

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} dk`;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

function Bar({ percent, label }: { percent: number; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
      <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

const PHASE_LABEL = { sahur: "İmsaka", fasting: "İftara", evening: "Yarın imsaka" } as const;

/** F76: Ramazan vakitleri ve geri sayım · F14: aralıklı oruç zamanlayıcısı. İkisi de kapalıysa görünmez. */
export function FastingCard() {
  const { data } = useFasting();
  const action = useFastingAction();
  if (!data) return null;
  const { ramadan, timer } = data;
  const showTimer = !ramadan && (timer.targetHours !== null || timer.active !== null);
  if (!ramadan && !showTimer) return null;

  // B26: Ramazan dışında iftar sayacı yerine Ramazan'a kalan gün.
  const outside = ramadan?.period && !ramadan.period.inRamadan ? ramadan.period : null;

  return (
    <div id={SECTION_ID} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 scroll-mt-4">
      {ramadan && outside && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Ramazan modu · {ramadan.province}</span>
            <Moon className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">Ramazan&apos;a {outside.daysUntil} gün</p>
          <p className="text-xs text-slate-600">
            Başlangıç {formatDateTr(outside.start)} (ilk oruç). Ramazan&apos;da imsak ve iftar sayacı burada görünür.
          </p>
          <p className="text-[11px] text-slate-400">
            Bugün imsak {ramadan.today.imsak} · iftar {ramadan.today.iftar}. Başlangıç günü Diyanet takvimiyle bir gün farklı olabilir.
          </p>
        </>
      )}
      {ramadan && !outside && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Ramazan · {ramadan.province}</span>
            <Moon className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {PHASE_LABEL[ramadan.phase]} {formatDuration(ramadan.minutesLeft)}
          </p>
          {ramadan.progressPercent !== null && <Bar percent={ramadan.progressPercent} label="Oruç ilerlemesi" />}
          <p className="text-xs text-slate-600">
            {ramadan.phase === "evening"
              ? `Yarın İmsak ${ramadan.tomorrow.imsak} · İftar ${ramadan.tomorrow.iftar}`
              : `İmsak ${ramadan.today.imsak} · İftar ${ramadan.today.iftar}`}
          </p>
          <p className="text-xs text-slate-500">{ramadan.waterAdvice}</p>
          <p className="text-[11px] text-slate-400">Vakitler internetsiz hesaplanır; Diyanet takvimiyle bir iki dakika fark olabilir.</p>
        </>
      )}

      {showTimer && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Aralıklı oruç</span>
            <Timer className="w-5 h-5 text-amber-600" />
          </div>
          {timer.active ? (
            <>
              <p className="text-2xl font-extrabold text-slate-900">
                {formatDuration(timer.active.elapsedMinutes)} / {timer.active.targetHours} sa
              </p>
              <Bar percent={timer.active.progressPercent} label="Oruç ilerlemesi" />
              <button
                type="button"
                disabled={action.isPending}
                onClick={() => action.mutate("stop")}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-50"
              >
                Orucu bitir
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={action.isPending}
              onClick={() => action.mutate("start")}
              className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50"
            >
              Orucu başlat ({timer.targetHours ?? 16} sa)
            </button>
          )}
          {timer.recent.length > 0 && (
            <p className="text-xs text-slate-500">
              Son {timer.recent.length} oruç: {timer.recent.filter((r) => r.reachedTarget).length} kez hedef tuttu.
            </p>
          )}
          <p className="text-[11px] text-slate-400">Hamilelik, emzirme, diyabet ya da yeme bozukluğu geçmişinde uzun oruçtan önce hekimine danış.</p>
        </>
      )}
      {action.isError && (
        <p role="alert" className="text-xs text-rose-700">
          {errorMessage(action.error, "İşlem yapılamadı.")}
        </p>
      )}
    </div>
  );
}
