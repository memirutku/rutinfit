"use client";

import { Bookmark, PenLine, Plus, Trash2, Utensils } from "lucide-react";
import type { FoodLog } from "@/lib/schemas/food";
import { formatNumberTr } from "@/lib/format";
import type { QuickFoodId } from "@/lib/quick-foods";

/** Ana paneldeki kısa öğün etiketleri (Hızlı Ekle penceresindeki uzun adlardan farklıdır). */
export function dashboardMealLabel(mealType: string): string {
  switch (mealType) {
    case "breakfast":
      return "Kahvaltı";
    case "lunch":
      return "Öğle Yemeği";
    case "workSnack":
      return "İş Çıkışı";
    case "dinner":
      return "Akşam Yemeği";
    default:
      return "Ara Öğün";
  }
}

interface TodayMealsListProps {
  logs: FoodLog[];
  onAdd: () => void;
  /** F56: kalori ve makroları gizle. */
  hideNumbers?: boolean;
  /** F01: kayıtlı öğünler ve kopyalama penceresi. */
  onOpenSavedMeals?: () => void;
  /** F06: yazarak öğün ekleme penceresi. */
  onOpenNaturalLog?: () => void;
  /** F79: Türk sofrası hızlı ekleme (simit, ekmek dilimi). */
  onQuickFood?: (item: QuickFoodId, count: number) => void;
  onDelete: (log: FoodLog) => void;
}

/** Bugün Kaydedilen Öğünler ve Hızlı Yönetim */
const QUICK_CHIPS: Array<{ label: string; item: QuickFoodId; count: number }> = [
  { label: "+ Simit", item: "simit", count: 1 },
  { label: "+ 1 dilim ekmek", item: "ekmek-dilimi", count: 1 },
  { label: "+ 2 dilim ekmek", item: "ekmek-dilimi", count: 2 },
];

export function TodayMealsList({ logs, onAdd, onDelete, hideNumbers = false, onOpenSavedMeals, onQuickFood, onOpenNaturalLog }: TodayMealsListProps) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Utensils className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Bugün Kaydedilen Öğünler</h3>
            <p className="text-xs text-slate-500">
              Günün besin kayıtları · Yanlış girişleri silebilir ve anında geri alabilirsiniz.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {onOpenNaturalLog && (
            <button
              type="button"
              onClick={onOpenNaturalLog}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
            >
              <PenLine className="w-3.5 h-3.5" />
              <span>Yazarak ekle</span>
            </button>
          )}
          {onOpenSavedMeals && (
            <button
              type="button"
              onClick={onOpenSavedMeals}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Kayıtlı öğünler</span>
            </button>
          )}
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Öğün Ekle</span>
          </button>
        </div>
      </div>

      {onQuickFood && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Hızlı</span>
          {QUICK_CHIPS.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => onQuickFood(c.item, c.count)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {logs.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <Utensils className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-600">Henüz bugün için bir öğün kaydetmediniz</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Yukarıdaki &quot;Hızlı Öğün Ekle&quot; butonuna basarak veya son kullanılanlardan seçerek başlayın.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {logs.map((log) => (
            <div
              key={log.id}
              className="py-3 flex items-center justify-between gap-3 group hover:bg-slate-50/50 px-2 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 shrink-0">
                  {dashboardMealLabel(log.mealType)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{log.name}</p>
                  <p className="text-xs text-slate-400">
                    {hideNumbers ? (
                      `${formatNumberTr(log.grams)}g`
                    ) : (
                      <>
                        {formatNumberTr(log.grams)}g · {formatNumberTr(log.caloriesSnapshot)} kcal · P: {formatNumberTr(log.proteinSnapshot)}g · K:{" "}
                        {formatNumberTr(log.carbsSnapshot)}g · Y: {formatNumberTr(log.fatSnapshot)}g
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onDelete(log)}
                  title="Öğünü Sil (Geri alınabilir)"
                  aria-label={`${log.name} öğününü sil`}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
