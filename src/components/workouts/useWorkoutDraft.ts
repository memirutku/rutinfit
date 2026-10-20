"use client";

import { useCallback, useEffect, useState } from "react";
import { parseWorkoutDraft, toDraft, WORKOUT_DRAFT_KEY, type ActiveWorkout, type WorkoutDraft } from "./session-form";

/**
 * Yarım kalan antrenman taslağı ("Kaldığın yerden devam et"). Açılışta bir kez okunur;
 * aktif seans değiştikçe otomatik kaydedilir. localStorage erişilemezse sessizce geçilir.
 */
export function useWorkoutDraft(active: ActiveWorkout | null) {
  const [savedDraft, setSavedDraft] = useState<WorkoutDraft | null>(null);

  useEffect(() => {
    try {
      setSavedDraft(parseWorkoutDraft(localStorage.getItem(WORKOUT_DRAFT_KEY)));
    } catch {
      // gizli pencere / erişim yok
    }
  }, []);

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
  const dismiss = useCallback(() => setSavedDraft(null), []);

  /** "Vazgeç": bildirimi gizler ve taslağı siler. */
  const discard = useCallback(() => {
    setSavedDraft(null);
    removeStored();
  }, [removeStored]);

  return { savedDraft, dismiss, discard, removeStored };
}
