"use client";

import { useState } from "react";
import { Repeat } from "lucide-react";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { EQUIPMENT_LABELS, type Equipment, type LibraryExercise } from "@/lib/exercise-library";

interface ExerciseSwapProps {
  exerciseName: string;
  onSwap: (newName: string) => void;
}

/**
 * F25: "Benzeriyle değiştir". Benzerler düğmeye basılınca bir kez getirilir (aktif seans
 * formunun sorgu sağlayıcısına bağımlı olmaması için doğrudan istek).
 */
export function ExerciseSwap({ exerciseName, onSwap }: ExerciseSwapProps) {
  const [open, setOpen] = useState(false);
  const [alts, setAlts] = useState<LibraryExercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && alts === null) {
      try {
        const data = await apiFetch<{ alternatives: LibraryExercise[] }>(
          `/api/exercises?alternativesFor=${encodeURIComponent(exerciseName)}`
        );
        setAlts(data.alternatives);
      } catch (e) {
        setError(errorMessage(e, "Benzer egzersiz bulunamadı."));
      }
    }
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-label={`${exerciseName} egzersizini değiştir`}
        aria-expanded={open}
        onClick={toggle}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:border-brand-400"
      >
        <Repeat className="w-3 h-3" />
        Değiştir
      </button>
      {open && (
        <span className="absolute z-20 left-0 mt-1 w-64 p-2 rounded-xl border border-slate-200 bg-white shadow-lg block space-y-1">
          {error && <span className="block text-xs text-rose-700">{error}</span>}
          {alts === null && !error && <span className="block text-xs text-slate-500">Yükleniyor...</span>}
          {alts?.length === 0 && <span className="block text-xs text-slate-500">Benzer egzersiz yok.</span>}
          {alts?.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                onSwap(a.name);
                setOpen(false);
              }}
              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-50 text-xs"
            >
              <span className="font-semibold text-slate-800">{a.nameTr}</span>{" "}
              <span className="text-slate-400">· {EQUIPMENT_LABELS[a.equipment as Equipment] ?? a.equipment}</span>
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
