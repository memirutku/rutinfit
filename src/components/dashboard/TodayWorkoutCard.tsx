"use client";

import { useId } from "react";
import Link from "next/link";
import { Clock, Dumbbell, ExternalLink } from "lucide-react";
import { useToday } from "@/hooks/useToday";
import { useWorkouts } from "@/lib/client/queries/workouts";
import type { WorkoutTemplate } from "@/lib/schemas/workout";
import type { Readiness } from "@/lib/readiness";
import { describeTemplate, todayWorkoutStatus, type TodayWorkoutStatus } from "@/lib/workout-day";

interface TodayWorkoutCardProps {
  /** F51: bugünkü hazır olma; düşükse kısaltılmış seans önerilir. */
  readiness?: Readiness | null;
  /**
   * @deprecated B20: kart günün şablonunu ve tamamlanma durumunu kendi verisinden belirler
   * (yapılan şablonla eşleştirerek). Pano bu iki propu artık göndermek zorunda değil; gönderilirse
   * yok sayılır.
   */
  template?: WorkoutTemplate;
  /** @deprecated B20: bkz. `template`. */
  isCompleted?: boolean;
}

/**
 * Günün Antrenmanı Kartı. B20: veriyi kendisi alır; "Tamamlandı" yalnız bugünün planlı şablonu
 * yapıldıysa görünür. Başka bir şablon yapıldıysa ayrıca yazılır.
 */
export function TodayWorkoutCard({ readiness }: TodayWorkoutCardProps) {
  const today = useToday();
  const workouts = useWorkouts(today);
  const status = todayWorkoutStatus(workouts.data?.templates ?? [], workouts.data?.sessions ?? [], today);
  return <TodayWorkoutView status={status} readiness={readiness} />;
}

/** Saf görünüm (test ve yeniden kullanım için). */
export function TodayWorkoutView({ status, readiness }: { status: TodayWorkoutStatus; readiness?: Readiness | null }) {
  const { planned, completed, doneOther } = status;
  // Dinlenme türündeki şablon da dinlenme günüdür.
  const training = planned && planned.type !== "rest" ? planned : undefined;
  const isTraining = !!training;
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Dumbbell className="w-4 h-4" />
            </div>
            <span id={titleId} className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Günün Antrenmanı
            </span>
          </div>
          {isTraining && (
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                completed ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
              }`}
            >
              {completed ? "Tamamlandı ✓" : "Bekliyor"}
            </span>
          )}
        </div>

        <h3 className="text-xl font-bold text-slate-900 mb-1">{training ? training.name : "Dinlenme günü"}</h3>
        <p className="text-sm text-slate-600 mb-3">{describeTemplate(planned)}</p>

        {doneOther.length > 0 && (
          <p className="mb-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
            Bugün yapılan: {doneOther.map((s) => s.name).join(", ")} ✓
          </p>
        )}

        {isTraining && !completed && readiness?.band === "low" && (
          <p role="note" className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
            Hazır olma düşük ({readiness.score}). Bugün 25 dakikalık kısaltılmış seans daha uygun olabilir; Antrenman
            sayfasında “25 dk Hafiflet” ile başlatabilirsin.
          </p>
        )}

        {training && (
          <div className="flex items-center gap-4 text-xs text-slate-500 font-medium mb-4">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Hedef: {training.targetDurationMinutes} dk
            </span>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
        <Link
          href={completed ? "/workouts#gecmis" : "/workouts"}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
        >
          <Dumbbell className="w-3.5 h-3.5" />
          <span>{completed ? "Seansı Gör" : "RutinFit'te Başla"}</span>
        </Link>
        <Link
          href="/opengym"
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold hover:bg-brand-100 transition-colors"
        >
          <span>openGym</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
        {isTraining && !completed && (
          <Link
            href="/coach"
            className="px-2.5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors text-center"
          >
            Hafiflet
          </Link>
        )}
      </div>
    </section>
  );
}
