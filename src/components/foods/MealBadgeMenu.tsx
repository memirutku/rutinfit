"use client";

import { useEffect, useId, useRef, useState } from "react";
import { errorMessage } from "@/lib/client/api";
import { useUpdateFoodLogMeal } from "@/lib/client/queries/nutrition";
import { MEAL_TYPES, mealTypeLabel, type MealType } from "@/lib/schemas/enums";
import type { FoodLog } from "@/lib/schemas/food";

interface MealBadgeMenuProps {
  log: FoodLog;
  /** Rozetin kısa adı (panodaki etiket). */
  label: string;
  ramadan?: boolean;
}

/**
 * B13: Öğün rozeti bir düğmedir; dokununca "Hangi öğün?" menüsü açılır ve seçilen öğün kayda
 * yazılır (sabah yenen simit yanlışlıkla "İş Çıkışı"na düştüyse düzeltilir).
 */
export function MealBadgeMenu({ log, label, ramadan = false }: MealBadgeMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const update = useUpdateFoodLogMeal();

  // Menü dışına tıklanınca kapanır.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(mealType: MealType) {
    setOpen(false);
    if (mealType !== log.mealType) update.mutate({ id: log.id, mealType });
  }

  return (
    <span ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${log.name} öğünü: ${label}. Değiştir`}
        disabled={update.isPending}
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-60"
      >
        {label}
      </button>
      {open && (
        <span
          id={menuId}
          role="menu"
          aria-label="Hangi öğün?"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setOpen(false);
            }
          }}
          className="absolute left-0 top-full mt-1 z-20 flex flex-col min-w-36 p-1 rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {MEAL_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="menuitemradio"
              aria-checked={log.mealType === t}
              onClick={() => choose(t)}
              className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                log.mealType === t ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {mealTypeLabel(t, ramadan)}
            </button>
          ))}
        </span>
      )}
      {update.isError && (
        <span role="alert" className="block text-[10px] text-rose-700">
          {errorMessage(update.error, "Öğün değiştirilemedi.")}
        </span>
      )}
    </span>
  );
}
