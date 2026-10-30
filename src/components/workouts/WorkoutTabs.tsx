"use client";

import { BookOpen, Calculator, Dumbbell, Layers, type LucideIcon } from "lucide-react";

export type WorkoutSubTab = "workouts" | "library" | "heatmap" | "plates";

const TABS: Array<{ id: WorkoutSubTab; label: string; icon: LucideIcon; iconClass: string }> = [
  { id: "workouts", label: "Şablonlar & Seans", icon: Dumbbell, iconClass: "text-brand-600" },
  { id: "library", label: "Egzersizler", icon: BookOpen, iconClass: "text-amber-600" },
  { id: "heatmap", label: "Kas Haritası", icon: Layers, iconClass: "text-indigo-600" },
  { id: "plates", label: "Plaka & 1RM", icon: Calculator, iconClass: "text-emerald-600" },
];

/** Sayfa başlığı ve alt sekmeler (şablonlar, kas haritası, plaka hesabı). */
export function WorkoutTabs({ tab, onChange }: { tab: WorkoutSubTab; onChange: (tab: WorkoutSubTab) => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Haftalık Antrenman & İlerleme 🏋️
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Haftalık plan, egzersiz kütüphanesi, kas haritası ve plaka hesabı
        </p>
      </div>

      <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
        {TABS.map(({ id, label, icon: Icon, iconClass }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
              tab === id ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Icon className={`w-4 h-4 ${iconClass}`} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
