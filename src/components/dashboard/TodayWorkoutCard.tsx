"use client";

import Link from "next/link";
import { Clock, Dumbbell, ExternalLink } from "lucide-react";
import type { WorkoutTemplate } from "@/lib/schemas/workout";

interface TodayWorkoutCardProps {
  /** Haftanın bugününe ait şablon; yoksa dinlenme günü gösterilir. */
  template?: WorkoutTemplate;
  isCompleted: boolean;
}

/** Günün Antrenmanı Kartı */
export function TodayWorkoutCard({ template, isCompleted }: TodayWorkoutCardProps) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Dumbbell className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Günün Antrenmanı</span>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              isCompleted ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
            }`}
          >
            {isCompleted ? "Tamamlandı ✓" : "Bekliyor"}
          </span>
        </div>

        <h3 className="text-xl font-bold text-slate-900 mb-1">{template ? template.name : "Dinlenme & Toparlanma"}</h3>
        <p className="text-sm text-slate-600 mb-3">
          {template?.notes || "Haftalık toparlanma ve hazırlık günü. İsteğe bağlı hafif yürüyüş."}
        </p>

        <div className="flex items-center gap-4 text-xs text-slate-500 font-medium mb-4">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Hedef: {template?.targetDurationMinutes || 0} dk
          </span>
          <span>·</span>
          <span>İş Çıkışı: 19:40 Başlangıç</span>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
        <Link
          href="/workouts"
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
        >
          <Dumbbell className="w-3.5 h-3.5" />
          <span>{isCompleted ? "Seansı Gör" : "RutinFit'te Başla"}</span>
        </Link>
        <Link
          href="/opengym"
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold hover:bg-brand-100 transition-colors"
        >
          <span>openGym</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
        {!isCompleted && (
          <Link
            href="/coach"
            className="px-2.5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors text-center"
          >
            Hafiflet
          </Link>
        )}
      </div>
    </div>
  );
}
