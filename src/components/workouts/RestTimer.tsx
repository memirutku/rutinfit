"use client";

import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import type { Countdown } from "@/hooks/useCountdown";

const PRESETS = [60, 90, 120, 180];

const format = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

/** Set arası dinlenme sayacı. Sayaç durumu üst bileşendeki useCountdown'dan gelir. */
export function RestTimer({ countdown }: { countdown: Countdown }) {
  const { secondsLeft, totalSeconds, isRunning, start, pause, resume, reset } = countdown;
  const status = isRunning ? "Süre akıyor..." : secondsLeft > 0 ? "Duraklatıldı" : "Hazır";

  return (
    <div className="p-4 bg-slate-900 rounded-2xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-800">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
            isRunning ? "bg-brand-600 animate-pulse text-white" : "bg-slate-800 text-slate-300"
          }`}
        >
          <Timer className="w-5 h-5" aria-hidden />
        </div>
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Set Arası Dinlenme Sayacı</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-extrabold text-emerald-400" aria-label={`Kalan süre ${secondsLeft} saniye`}>
              {format(secondsLeft)}
            </span>
            <span className="text-xs text-slate-400" aria-live="polite">
              {status}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex gap-1" role="group" aria-label="Dinlenme süresi seç">
          {PRESETS.map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => start(sec)}
              aria-pressed={totalSeconds === sec && (isRunning || secondsLeft > 0)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                totalSeconds === sec && (isRunning || secondsLeft > 0)
                  ? "bg-brand-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {sec}s
            </button>
          ))}
        </div>

        {isRunning ? (
          <button
            type="button"
            onClick={pause}
            aria-label="Sayacı duraklat"
            className="p-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 text-xs font-bold"
          >
            <Pause className="w-4 h-4" aria-hidden />
          </button>
        ) : secondsLeft > 0 ? (
          <button
            type="button"
            onClick={resume}
            aria-label="Sayaca devam et"
            className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs font-bold"
          >
            <Play className="w-4 h-4" aria-hidden />
          </button>
        ) : null}

        {secondsLeft > 0 && (
          <button
            type="button"
            onClick={reset}
            aria-label="Sayacı sıfırla"
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 text-xs"
          >
            <RotateCcw className="w-4 h-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
