"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { computeMuscleLoad, type SessionForLoad } from "@/lib/muscle-load";
import { useToday } from "@/hooks/useToday";
import { Activity } from "lucide-react";

export interface MuscleFatigue {
  muscleId: string;
  nameTr: string;
  nameLatin: string;
  side: "front" | "back";
  weeklySets: number;
  lastTrainedDaysAgo?: number;
  category: "push" | "pull" | "legs" | "core";
  exercises: string[];
}

interface MuscleHeatmapProps {
  /** Son seanslar (setLogs ile). Verilmezse tüm kaslar 0 set gösterilir. */
  workoutSessions?: SessionForLoad[];
  onSelectMuscle?: (muscle: MuscleFatigue) => void;
}

// Varsayılan kas grubu tanımları ve egzersiz eşleştirmeleri
export const DEFAULT_MUSCLES: MuscleFatigue[] = [
  // ÖN VÜCUT
  {
    muscleId: "chest",
    nameTr: "Göğüs (Pektoralis)",
    nameLatin: "Pectoralis Major & Minor",
    side: "front",
    weeklySets: 8,
    lastTrainedDaysAgo: 1,
    category: "push",
    exercises: ["Bench Press", "Dumbbell Press", "Pushup", "Incline Dumbbell Press"],
  },
  {
    muscleId: "front_delts",
    nameTr: "Ön Omuz",
    nameLatin: "Anterior Deltoid",
    side: "front",
    weeklySets: 6,
    lastTrainedDaysAgo: 1,
    category: "push",
    exercises: ["Overhead Press", "Incline Press", "Front Raise"],
  },
  {
    muscleId: "side_delts",
    nameTr: "Yan Omuz",
    nameLatin: "Lateral Deltoid",
    side: "front",
    weeklySets: 7,
    lastTrainedDaysAgo: 2,
    category: "push",
    exercises: ["Lateral Raise", "Upright Row"],
  },
  {
    muscleId: "biceps",
    nameTr: "Pazı (Biceps)",
    nameLatin: "Biceps Brachii",
    side: "front",
    weeklySets: 5,
    lastTrainedDaysAgo: 3,
    category: "pull",
    exercises: ["Bicep Curl", "Hammer Curl", "Chin-up"],
  },
  {
    muscleId: "forearms",
    nameTr: "Ön Kol",
    nameLatin: "Brachioradialis",
    side: "front",
    weeklySets: 4,
    lastTrainedDaysAgo: 3,
    category: "pull",
    exercises: ["Deadlift", "Farmer's Walk", "Wrist Curl"],
  },
  {
    muscleId: "abs",
    nameTr: "Karın (Core)",
    nameLatin: "Rectus Abdominis",
    side: "front",
    weeklySets: 4,
    lastTrainedDaysAgo: 2,
    category: "core",
    exercises: ["Plank", "Cable Crunch", "Hanging Leg Raise"],
  },
  {
    muscleId: "obliques",
    nameTr: "Yan Karın",
    nameLatin: "External Obliques",
    side: "front",
    weeklySets: 2,
    lastTrainedDaysAgo: 4,
    category: "core",
    exercises: ["Side Plank", "Russian Twist"],
  },
  {
    muscleId: "quads",
    nameTr: "Ön Bacak (Quadriceps)",
    nameLatin: "Quadriceps Femoris",
    side: "front",
    weeklySets: 10,
    lastTrainedDaysAgo: 2,
    category: "legs",
    exercises: ["Squat", "Leg Press", "Bulgarian Split Squat", "Leg Extension"],
  },
  {
    muscleId: "calves_front",
    nameTr: "Kaval & Alt Bacak",
    nameLatin: "Tibialis Anterior",
    side: "front",
    weeklySets: 3,
    lastTrainedDaysAgo: 2,
    category: "legs",
    exercises: ["Calf Raise", "Tibialis Raise"],
  },

  // ARKA VÜCUT
  {
    muscleId: "traps",
    nameTr: "Trapez & Boyun",
    nameLatin: "Trapezius (Upper & Mid)",
    side: "back",
    weeklySets: 6,
    lastTrainedDaysAgo: 3,
    category: "pull",
    exercises: ["Shrug", "Deadlift", "Face Pull"],
  },
  {
    muscleId: "rear_delts",
    nameTr: "Arka Omuz",
    nameLatin: "Posterior Deltoid",
    side: "back",
    weeklySets: 5,
    lastTrainedDaysAgo: 3,
    category: "pull",
    exercises: ["Face Pull", "Rear Delt Fly", "Barbell Row"],
  },
  {
    muscleId: "lats",
    nameTr: "Sırt & Kanat",
    nameLatin: "Latissimus Dorsi",
    side: "back",
    weeklySets: 9,
    lastTrainedDaysAgo: 3,
    category: "pull",
    exercises: ["Lat Pulldown", "Barbell Row", "Seated Cable Row", "Pull-up"],
  },
  {
    muscleId: "lower_back",
    nameTr: "Bel & Erektör",
    nameLatin: "Erector Spinae",
    side: "back",
    weeklySets: 6,
    lastTrainedDaysAgo: 3,
    category: "pull",
    exercises: ["RDL (Romanian Deadlift)", "Deadlift", "Back Extension"],
  },
  {
    muscleId: "triceps",
    nameTr: "Arka Kol (Triceps)",
    nameLatin: "Triceps Brachii",
    side: "back",
    weeklySets: 7,
    lastTrainedDaysAgo: 1,
    category: "push",
    exercises: ["Tricep Pushdown", "Skull Crusher", "Dips", "Close Grip Bench"],
  },
  {
    muscleId: "glutes",
    nameTr: "Kalça (Glute)",
    nameLatin: "Gluteus Maximus & Medius",
    side: "back",
    weeklySets: 8,
    lastTrainedDaysAgo: 2,
    category: "legs",
    exercises: ["Squat", "Hip Thrust", "RDL", "Lunge"],
  },
  {
    muscleId: "hamstrings",
    nameTr: "Arka Bacak (Hamstring)",
    nameLatin: "Biceps Femoris & Semitendinosus",
    side: "back",
    weeklySets: 8,
    lastTrainedDaysAgo: 2,
    category: "legs",
    exercises: ["RDL", "Leg Curl", "Stiff-Leg Deadlift"],
  },
  {
    muscleId: "calves_back",
    nameTr: "Baldır (Calf)",
    nameLatin: "Gastrocnemius & Soleus",
    side: "back",
    weeklySets: 5,
    lastTrainedDaysAgo: 2,
    category: "legs",
    exercises: ["Standing Calf Raise", "Seated Calf Raise"],
  },
];

export function MuscleHeatmap({ workoutSessions, onSelectMuscle }: MuscleHeatmapProps) {
  const today = useToday();
  // Seanslar verilmediyse (ör. openGym sayfası) bir kez sunucudan alınır.
  const [fetchedSessions, setFetchedSessions] = useState<SessionForLoad[] | null>(null);
  useEffect(() => {
    if (workoutSessions) return;
    let cancelled = false;
    apiFetch<{ sessions?: SessionForLoad[] }>("/api/workouts")
      .then((d) => !cancelled && setFetchedSessions(d.sessions ?? []))
      .catch(() => !cancelled && setFetchedSessions([]));
    return () => {
      cancelled = true;
    };
  }, [workoutSessions]);
  const sessions = workoutSessions ?? fetchedSessions;

  // Gerçek set hacmi: son 7 günün tamamlanmış seanslarından hesaplanır.
  const muscles = useMemo(
    () => computeMuscleLoad(DEFAULT_MUSCLES, sessions ?? [], today),
    [sessions, today]
  );
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_MUSCLES[0].muscleId);
  const selectedMuscle = muscles.find((m) => m.muscleId === selectedId) ?? muscles[0];
  const [viewMode, setViewMode] = useState<"front" | "back" | "both">("both");
  const [gender, setGender] = useState<"male" | "female">("male");

  // Kasın yorgunluk/toparlanma durumunu belirleyen yardımcı
  function getFatigueStatus(sets: number, daysAgo?: number) {
    if (sets >= 8 && (daysAgo === undefined || daysAgo <= 2)) {
      return {
        label: "Yüksek Yorgunluk / Yakın Seans",
        colorClass: "fill-rose-500 hover:fill-rose-400 stroke-rose-600",
        badgeBg: "bg-rose-100 text-rose-800 border-rose-200",
        recoveryHours: "48 - 72 saat dinlenme önerilir",
        level: "high",
      };
    }
    if (sets >= 4 || (daysAgo !== undefined && daysAgo <= 3)) {
      return {
        label: "Orta Yorgunluk / Toparlanıyor",
        colorClass: "fill-amber-500 hover:fill-amber-400 stroke-amber-600",
        badgeBg: "bg-amber-100 text-amber-800 border-amber-200",
        recoveryHours: "24 - 48 saat dinlenme önerilir",
        level: "moderate",
      };
    }
    return {
      label: "Tamamen Dinlenmiş / Hazır",
      colorClass: "fill-emerald-500 hover:fill-emerald-400 stroke-emerald-600",
      badgeBg: "bg-emerald-100 text-emerald-800 border-emerald-200",
      recoveryHours: "Antrenmana tamamen hazır",
      level: "fresh",
    };
  }

  function handleMuscleClick(m: MuscleFatigue) {
    setSelectedId(m.muscleId);
    if (onSelectMuscle) onSelectMuscle(m);
  }

  const currentStatus = getFatigueStatus(
    selectedMuscle.weeklySets,
    selectedMuscle.lastTrainedDaysAgo
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
      {/* Üst Başlık & Kontroller */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-lg">
              Kas Yorgunluk & Toparlanma Haritası 🧬
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200">
              MuscleMapJS (MIT)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Son 7 gündeki set hacminize göre kas toparlanma durumunu interaktif olarak gösterir.
          </p>
        </div>

        {/* Görünüm & Cinsiyet Butonları */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setViewMode("both")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                viewMode === "both" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Ön + Arka
            </button>
            <button
              onClick={() => setViewMode("front")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                viewMode === "front" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Yalnızca Ön
            </button>
            <button
              onClick={() => setViewMode("back")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                viewMode === "back" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Yalnızca Arka
            </button>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setGender("male")}
              className={`px-2.5 py-1.5 rounded-lg transition-colors ${
                gender === "male" ? "bg-white text-brand-600 shadow-xs font-bold" : "text-slate-600"
              }`}
            >
              Erkek
            </button>
            <button
              onClick={() => setGender("female")}
              className={`px-2.5 py-1.5 rounded-lg transition-colors ${
                gender === "female" ? "bg-white text-brand-600 shadow-xs font-bold" : "text-slate-600"
              }`}
            >
              Kadın
            </button>
          </div>
        </div>
      </div>

      {/* Lejant (Renk Skalası) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
        <span className="font-semibold text-slate-700">Toparlanma Durumu:</span>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-xs" />
            <span className="text-slate-600">Dinlenmiş (0-3 set / 72h+)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-amber-500 shadow-xs" />
            <span className="text-slate-600">Orta Seviye (4-7 set / 24-48h)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-xs" />
            <span className="text-slate-600">Yüksek Yorgunluk (8+ set / &lt;24h)</span>
          </div>
        </div>
      </div>

      {/* Harita ve Detay Paneli Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* SVG Vücut Modeli */}
        <div className="lg:col-span-7 flex flex-wrap justify-center items-center gap-8 p-6 bg-slate-900 rounded-2xl border border-slate-800 text-white min-h-[420px]">
          {/* Ön Vücut */}
          {(viewMode === "both" || viewMode === "front") && (
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Ön Vücut (Anterior)
              </span>
              <svg
                viewBox="0 0 200 400"
                className="w-48 h-96 select-none cursor-pointer"
                aria-label="Ön kas haritası"
              >
                {/* Gövde Silüeti Arka Planı */}
                <path
                  d="M 100,20 C 110,20 118,28 118,40 C 118,52 110,60 100,60 C 90,60 82,52 82,40 C 82,28 90,20 100,20 Z"
                  fill="#1e293b"
                  stroke="#334155"
                  strokeWidth="1.5"
                />
                <path
                  d="M 75,65 Q 100,70 125,65 L 145,85 L 160,150 L 150,210 L 140,215 L 140,160 L 130,220 L 132,300 L 125,380 L 105,380 L 105,250 L 95,250 L 95,380 L 75,380 L 68,300 L 70,220 L 60,160 L 60,215 L 50,210 L 40,150 L 55,85 Z"
                  fill="#0f172a"
                  stroke="#334155"
                  strokeWidth="1.5"
                />

                {/* Ön Omuzlar */}
                <path
                  d="M 68,75 Q 80,72 85,82 L 72,105 Q 60,95 68,75 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "front_delts"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[1].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[1])}
                />
                <path
                  d="M 132,75 Q 120,72 115,82 L 128,105 Q 140,95 132,75 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "front_delts"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[1].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[1])}
                />

                {/* Göğüs (Pectoralis) */}
                <path
                  d="M 85,82 Q 100,85 100,105 L 80,118 Q 72,105 85,82 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "chest"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[0].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[0])}
                />
                <path
                  d="M 115,82 Q 100,85 100,105 L 120,118 Q 128,105 115,82 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "chest"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[0].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[0])}
                />

                {/* Biceps */}
                <path
                  d="M 60,110 Q 56,130 63,145 L 70,140 Q 68,125 70,110 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "biceps"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[3].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[3])}
                />
                <path
                  d="M 140,110 Q 144,130 137,145 L 130,140 Q 132,125 130,110 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "biceps"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[3].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[3])}
                />

                {/* Ön Kol (Forearms) */}
                <path
                  d="M 63,150 Q 55,180 52,205 L 58,208 Q 66,180 70,150 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "forearms"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[4].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[4])}
                />
                <path
                  d="M 137,150 Q 145,180 148,205 L 142,208 Q 134,180 130,150 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "forearms"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[4].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[4])}
                />

                {/* Karın (Abs) */}
                <path
                  d="M 85,122 L 115,122 L 113,175 L 87,175 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "abs"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[5].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[5])}
                />

                {/* Ön Bacak (Quadriceps) */}
                <path
                  d="M 75,195 Q 68,230 73,280 L 96,280 Q 98,230 96,195 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "quads"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[7].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[7])}
                />
                <path
                  d="M 125,195 Q 132,230 127,280 L 104,280 Q 102,230 104,195 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "quads"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[7].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[7])}
                />

                {/* Ön Alt Bacak (Calves Front) */}
                <path
                  d="M 75,295 Q 70,335 77,370 L 92,370 Q 95,335 93,295 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "calves_front"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[8].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[8])}
                />
                <path
                  d="M 125,295 Q 130,335 123,370 L 108,370 Q 105,335 107,295 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "calves_front"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[8].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[8])}
                />
              </svg>
            </div>
          )}

          {/* Arka Vücut */}
          {(viewMode === "both" || viewMode === "back") && (
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Arka Vücut (Posterior)
              </span>
              <svg
                viewBox="0 0 200 400"
                className="w-48 h-96 select-none cursor-pointer"
                aria-label="Arka kas haritası"
              >
                {/* Gövde Silüeti Arka Planı */}
                <path
                  d="M 100,20 C 110,20 118,28 118,40 C 118,52 110,60 100,60 C 90,60 82,52 82,40 C 82,28 90,20 100,20 Z"
                  fill="#1e293b"
                  stroke="#334155"
                  strokeWidth="1.5"
                />
                <path
                  d="M 75,65 Q 100,70 125,65 L 145,85 L 160,150 L 150,210 L 140,215 L 140,160 L 130,220 L 132,300 L 125,380 L 105,380 L 105,250 L 95,250 L 95,380 L 75,380 L 68,300 L 70,220 L 60,160 L 60,215 L 50,210 L 40,150 L 55,85 Z"
                  fill="#0f172a"
                  stroke="#334155"
                  strokeWidth="1.5"
                />

                {/* Trapezler (Traps) */}
                <path
                  d="M 85,65 L 115,65 L 122,95 L 100,115 L 78,95 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "traps"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[9].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[9])}
                />

                {/* Arka Omuzlar (Rear Delts) */}
                <path
                  d="M 68,75 Q 76,73 78,95 L 65,102 Q 60,88 68,75 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "rear_delts"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[10].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[10])}
                />
                <path
                  d="M 132,75 Q 124,73 122,95 L 135,102 Q 140,88 132,75 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "rear_delts"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[10].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[10])}
                />

                {/* Triceps (Arka Kol) */}
                <path
                  d="M 58,105 Q 55,130 62,145 L 68,142 Q 68,125 65,105 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "triceps"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[13].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[13])}
                />
                <path
                  d="M 142,105 Q 145,130 138,145 L 132,142 Q 132,125 135,105 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "triceps"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[13].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[13])}
                />

                {/* Kanat & Sırt (Lats) */}
                <path
                  d="M 76,96 L 98,115 L 94,155 L 75,142 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "lats"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[11].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[11])}
                />
                <path
                  d="M 124,96 L 102,115 L 106,155 L 125,142 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "lats"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[11].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[11])}
                />

                {/* Bel & Erektör (Lower Back) */}
                <path
                  d="M 88,155 L 112,155 L 110,185 L 90,185 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "lower_back"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[12].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[12])}
                />

                {/* Kalça (Glutes) */}
                <path
                  d="M 75,188 L 98,188 L 96,230 L 73,225 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "glutes"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[14].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[14])}
                />
                <path
                  d="M 125,188 L 102,188 L 104,230 L 127,225 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "glutes"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[14].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[14])}
                />

                {/* Arka Bacak (Hamstrings) */}
                <path
                  d="M 75,235 Q 70,265 74,285 L 95,285 Q 96,260 96,235 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "hamstrings"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[15].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[15])}
                />
                <path
                  d="M 125,235 Q 130,265 126,285 L 105,285 Q 104,260 104,235 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "hamstrings"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[15].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[15])}
                />

                {/* Baldır (Calves Back) */}
                <path
                  d="M 73,295 Q 67,330 76,370 L 92,370 Q 96,335 94,295 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "calves_back"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[16].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[16])}
                />
                <path
                  d="M 127,295 Q 133,330 124,370 L 108,370 Q 104,335 106,295 Z"
                  className={`transition-all duration-200 ${
                    selectedMuscle.muscleId === "calves_back"
                      ? "stroke-white stroke-2"
                      : ""
                  } ${getFatigueStatus(muscles[16].weeklySets).colorClass}`}
                  onClick={() => handleMuscleClick(muscles[16])}
                />
              </svg>
            </div>
          )}
        </div>

        {/* Seçili Kas Detay Kartı */}
        <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {selectedMuscle.category.toUpperCase()} GRUBU
              </span>
              <h4 className="text-base font-extrabold text-slate-900 mt-0.5">
                {selectedMuscle.nameTr}
              </h4>
              <p className="text-xs italic text-slate-500">
                {selectedMuscle.nameLatin}
              </p>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-bold border ${currentStatus.badgeBg}`}
            >
              {currentStatus.label.split("/")[0]}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">Haftalık Hacim</span>
              <span className="text-xl font-extrabold text-slate-900">
                {selectedMuscle.weeklySets} Set
              </span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">Son Seans</span>
              <span className="text-xl font-extrabold text-slate-900">
                {selectedMuscle.lastTrainedDaysAgo !== undefined
                  ? `${selectedMuscle.lastTrainedDaysAgo} gün önce`
                  : "Bu hafta yok"}
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Activity className="w-4 h-4 text-brand-600" />
              <span>Toparlanma Önerisi:</span>
            </div>
            <p className="text-slate-600 pl-5">
              {currentStatus.recoveryHours}
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 block">
              Bu Kası Çalıştıran Egzersizler:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {selectedMuscle.exercises.map((ex) => (
                <span
                  key={ex}
                  className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs"
                >
                  {ex}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
            <span>Kas haritasında kaslara tıklayarak detayları görebilirsiniz.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
