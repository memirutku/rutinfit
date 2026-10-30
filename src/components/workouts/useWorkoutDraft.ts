"use client";

import { useCallback, useEffect, useState } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import { parseWorkoutDraft, toDraft, WORKOUT_DRAFT_KEY, type ActiveWorkout, type WorkoutDraft } from "./session-form";

function readStoredDraft(): WorkoutDraft | null {
  if (typeof window === "undefined") return null;
  try {
    return parseWorkoutDraft(window.localStorage.getItem(WORKOUT_DRAFT_KEY));
  } catch {
    // gizli pencere / erişim yok
    return null;
  }
}

/**
 * Yarım kalan antrenman taslağı ("Kaldığın yerden devam et"). Açılışta bir kez okunur;
 * aktif seans değiştikçe otomatik kaydedilir. localStorage erişilemezse sessizce geçilir.
 * Sunucu HTML'inde ve hydration render'ında bildirim yoktur (localStorage yalnız tarayıcıda);
 * hydration'dan hemen sonra gösterilir.
 */
export function useWorkoutDraft(active: ActiveWorkout | null) {
  // Açılıştaki kayıt bir kez okunur; otomatik kayıtlar bildirimi değiştirmez.
  const [draftAtMount] = useState(readStoredDraft);
  const [hidden, setHidden] = useState(false);
  const hydrated = useHydrated();
  const savedDraft = hydrated && !hidden ? draftAtMount : null;

  useEffect(() => {
    if (!active || !active.form.name) return;
    try {
      localStorage.setItem(WORKOUT_DRAFT_KEY, JSON.stringify(toDraft(active)));
    } catch {
      // kota / gizli pencere
    }
  }, [active]);

  /** Kayıtlı taslağı siler (bildirim durumu değişmez). */
  const removeStored = useCallback(() => {
    try {
      localStorage.removeItem(WORKOUT_DRAFT_KEY);
    } catch {
      // erişim yok
    }
  }, []);

  /** Bildirimi gizler; taslak kayıtlı kalır (devam edilen seans üzerine yazar). */
  const dismiss = useCallback(() => setHidden(true), []);

  /** "Vazgeç": bildirimi gizler ve taslağı siler. */
  const discard = useCallback(() => {
    setHidden(true);
    removeStored();
  }, [removeStored]);

  return { savedDraft, dismiss, discard, removeStored };
}
