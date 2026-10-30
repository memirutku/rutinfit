"use client";

import { useId } from "react";
import { startOfWeek } from "@/lib/date-utils";
import type { WorkoutSession, WorkoutTemplate } from "@/lib/schemas/workout";
import { describeTemplate, sessionMatchesTemplate, weekdayOf } from "@/lib/workout-day";
import type { SessionTemplate } from "./session-form";

export const DAYS_OF_WEEK = [
  { day: 1, name: "Pazartesi" },
  { day: 2, name: "Salı" },
  { day: 3, name: "Çarşamba" },
  { day: 4, name: "Perşembe" },
  { day: 5, name: "Cuma" },
  { day: 6, name: "Cumartesi" },
  { day: 7, name: "Pazar" },
] as const;

/** "YYYY-MM-DD" gününün Türkçe adı ("Perşembe"). */
export { weekdayOf };

export const dayNameOf = (dateStr: string) => DAYS_OF_WEEK.find((d) => d.day === weekdayOf(dateStr))?.name ?? "";

/** Kolay koşu günü tek "egzersiz" olarak kaydedilir (tekrar = dakika). */
export function runSessionTemplate(template: WorkoutTemplate): SessionTemplate {
  return {
    ...template,
    exercises: [{ exerciseName: "Kolay Koşu (Konuşma Temposu)", repMin: 25, repMax: 35 }],
  };
}

type StartSession = (template: SessionTemplate, shortened: boolean) => void;

/** F17: şablonu düzenle (şablon) ya da o gün için yeni şablon ekle (null). */
type EditTemplate = (template: WorkoutTemplate | null, dayOfWeek: number) => void;

interface WeeklyPlanGridProps {
  templates: WorkoutTemplate[];
  loading: boolean;
  onStart: StartSession;
  onEdit?: EditTemplate;
  /** F18: hazır program penceresini açar. */
  onPickProgram?: () => void;
  /** F28: metinden antrenman penceresini açar. */
  onTextEntry?: () => void;
  /** B20: bugün (YYYY-MM-DD); bugünün kartı vurgulanır. */
  today?: string;
  /** B20: son seanslar; bu hafta yapılan şablon işaretlenir. */
  sessions?: WorkoutSession[];
}

/** Haftalık plan: her gün için şablon kartı ve seans başlatma düğmeleri. */
export function WeeklyPlanGrid({ templates, loading, onStart, onEdit, onPickProgram, onTextEntry, today, sessions = [] }: WeeklyPlanGridProps) {
  const todayWeekday = today ? weekdayOf(today) : null;
  // B20: bu hafta (Pazartesi'den bugüne) tamamlanan seanslar.
  const weekStart = today ? startOfWeek(today) : null;
  const thisWeek = weekStart ? sessions.filter((x) => x.completed && x.date >= weekStart && x.date <= today!) : [];
  const doneThisWeek = (t: WorkoutTemplate) => thisWeek.some((x) => sessionMatchesTemplate(x, t));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-900 text-base">Haftalık Antrenman Planı</h3>
        <div className="flex items-center gap-2">
        {onTextEntry && (
          <button
            type="button"
            onClick={onTextEntry}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Metinden ekle
          </button>
        )}
        {onPickProgram && (
          <button
            type="button"
            onClick={onPickProgram}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Hazır program
          </button>
        )}
        </div>
      </div>
      {loading && (
        <p role="status" className="text-sm text-slate-500">
          Antrenman planı yükleniyor...
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {DAYS_OF_WEEK.flatMap((d) => {
          // B18: "Plana ekle" ile aynı güne eklenen şablonların hepsi görünür (yalnız ilki değil).
          const dayTemplates = templates.filter((t) => t.dayOfWeek === d.day);
          const edit = onEdit ? (t: WorkoutTemplate | null) => onEdit(t, d.day) : undefined;
          const isToday = d.day === todayWeekday;
          return dayTemplates.length === 0
            ? [<DayTemplateCard key={d.day} dayName={d.name} isToday={isToday} onStart={onStart} onEdit={edit} />]
            : dayTemplates.map((t) => (
                <DayTemplateCard
                  key={t.id}
                  dayName={d.name}
                  template={t}
                  isToday={isToday}
                  doneThisWeek={doneThisWeek(t)}
                  onStart={onStart}
                  onEdit={edit}
                />
              ));
        })}
      </div>
    </div>
  );
}

interface DayTemplateCardProps {
  dayName: string;
  template?: WorkoutTemplate;
  /** B20: bugünün kartı vurgulanır. */
  isToday?: boolean;
  /** B20: bu hafta yapıldı. */
  doneThisWeek?: boolean;
  onStart: StartSession;
  onEdit?: (template: WorkoutTemplate | null) => void;
}

export function DayTemplateCard({ dayName, template, isToday = false, doneThisWeek = false, onStart, onEdit }: DayTemplateCardProps) {
  const isStrength = template?.type === "strength";
  const isRun = template?.type === "easy_run";
  const headingId = useId();

  return (
    <article
      aria-labelledby={headingId}
      aria-current={isToday ? "date" : undefined}
      className={`bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between ${
        isToday ? "border-brand-500 ring-2 ring-brand-200" : "border-slate-200"
      }`}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-bold uppercase tracking-wider ${isToday ? "text-brand-700" : "text-slate-400"}`}>
            {dayName}
            {isToday && <span className="ml-1.5 normal-case tracking-normal px-1.5 py-0.5 rounded-md bg-brand-600 text-white">Bugün</span>}
          </span>
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              isStrength
                ? "bg-indigo-50 text-indigo-700"
                : isRun
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {isStrength ? "Ağırlık Seansı" : isRun ? "Kolay Koşu" : "Dinlenme"}
          </span>
        </div>

        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 id={headingId} className="font-bold text-slate-900 text-base">
            {template?.name || "Dinlenme"}
          </h4>
          {onEdit && (
            <button
              type="button"
              aria-label={template ? `${template.name} şablonunu düzenle` : `${dayName} için şablon ekle`}
              onClick={() => onEdit(template ?? null)}
              className="shrink-0 px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              {template ? "Düzenle" : "+ Şablon"}
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500 mb-3 leading-relaxed">{describeTemplate(template)}</p>
        {doneThisWeek && (
          <p className="mb-3 inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Bu hafta yapıldı ✓</p>
        )}

        {/* Hareketler listesi */}
        {template?.exercises && template.exercises.length > 0 && (
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-4 text-xs">
            <p className="font-semibold text-slate-700 mb-1">Hareketler ({template.exercises.length}):</p>
            <ul className="space-y-0.5 text-slate-600">
              {template.exercises.map((ex) => (
                <li key={ex.id} className="truncate">
                  • {ex.exerciseName} ({ex.targetSets} set × {ex.repMin}-{ex.repMax} tk)
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {template && isStrength && (
        <div className="pt-3 border-t border-slate-100 flex gap-2">
          <button
            onClick={() => onStart(template, false)}
            className="flex-1 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
          >
            Başla ({template.targetDurationMinutes} dk)
          </button>
          <button
            onClick={() => onStart(template, true)}
            title="Yorgun hissediyorsanız 25 dk hafifletilmiş seans"
            className="py-2 px-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
          >
            25 dk Hafiflet
          </button>
        </div>
      )}

      {template && isRun && (
        <div className="pt-3 border-t border-slate-100">
          <button
            onClick={() => onStart(runSessionTemplate(template), false)}
            className="w-full py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
          >
            Koşu Seansı Kaydet (25-35 dk)
          </button>
        </div>
      )}
    </article>
  );
}
