"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { errorMessage } from "@/lib/client/api";
import {
  useApplySavedMeal,
  useCopyFoodLogs,
  useDeleteSavedMeal,
  useSaveMeal,
  useSavedMeals,
} from "@/lib/client/queries/saved-meals";
import { addDaysToDateString } from "@/lib/date-utils";
import { formatDateTr } from "@/lib/format";
import { MEAL_TYPES, MEAL_TYPE_LABELS, type MealType } from "@/lib/schemas/enums";
import type { FoodLog } from "@/lib/schemas/food";
import type { SavedMealSummary } from "@/lib/schemas/saved-meals";

interface SavedMealsModalProps {
  open: boolean;
  date: string;
  todayLogs: FoodLog[];
  onClose: () => void;
  hideNumbers?: boolean;
}

const LABEL = "block text-xs font-bold text-slate-700 mb-1";
const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";
const BUTTON = "px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50";

function SavedMealRow({ meal, date, hideNumbers, onDone }: { meal: SavedMealSummary; date: string; hideNumbers: boolean; onDone: (msg: string) => void }) {
  const [mealType, setMealType] = useState<MealType>((meal.mealType as MealType) ?? "extra");
  const apply = useApplySavedMeal();
  const remove = useDeleteSavedMeal();
  return (
    <li className="p-3 rounded-xl border border-slate-200 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">{meal.name}</p>
          <p className="text-xs text-slate-500">
            {meal.itemCount} kalem{hideNumbers ? "" : ` · ${meal.totalCalories} kcal`} · {meal.items.map((i) => i.name).join(", ")}
          </p>
        </div>
        <button
          type="button"
          aria-label={`${meal.name} kayıtlı öğününü sil`}
          disabled={remove.isPending}
          onClick={() => remove.mutate(meal.id)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <select
          aria-label={`${meal.name} hangi öğüne`}
          value={mealType}
          onChange={(e) => setMealType(e.target.value as MealType)}
          className={INPUT}
        >
          {MEAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {MEAL_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label={`${meal.name} bugüne ekle`}
          disabled={apply.isPending}
          onClick={() =>
            apply.mutate(
              { savedMealId: meal.id, date, mealType },
              { onSuccess: (r) => onDone(`${meal.name}: ${r.created} kalem eklendi.`) }
            )
          }
          className={`${BUTTON} shrink-0`}
        >
          Bugüne ekle
        </button>
      </div>
    </li>
  );
}

/**
 * F01: Kayıtlı öğünler ve kopyalama. Bugünün bir öğününü kaydet, kayıtlı öğünü bugüne ekle,
 * dünün öğünlerini (tamamını ya da birini) bugüne kopyala.
 */
export function SavedMealsModal({ open, date, todayLogs, onClose, hideNumbers = false }: SavedMealsModalProps) {
  const presentTypes = MEAL_TYPES.filter((t) => todayLogs.some((l) => l.mealType === t));
  const [saveType, setSaveType] = useState<MealType | "">("");
  const [name, setName] = useState("");
  const [copyType, setCopyType] = useState<MealType | "all">("all");
  const [notice, setNotice] = useState<string | null>(null);
  const saved = useSavedMeals({ enabled: open });
  const save = useSaveMeal();
  const copy = useCopyFoodLogs();
  const chosenType = saveType || presentTypes[0];
  const error = save.error ?? copy.error;

  return (
    <Modal open={open} onClose={onClose} title="Kayıtlı öğünler" description="Sık yediklerini kaydet, tek tıkla ekle." widthClass="max-w-lg">
      <div className="space-y-5">
        {notice && (
          <p role="status" className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
            {errorMessage(error, "İşlem yapılamadı.")}
          </p>
        )}

        <section className="space-y-2">
          <h4 className="text-sm font-bold text-slate-900">Bugünkü öğünü kaydet</h4>
          {presentTypes.length === 0 ? (
            <p className="text-xs text-slate-500">Bugün henüz kayıt yok; önce bir öğün ekle.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="saved-meal-type" className={LABEL}>
                  Kaydedilecek öğün
                </label>
                <select id="saved-meal-type" value={chosenType} onChange={(e) => setSaveType(e.target.value as MealType)} className={INPUT}>
                  {presentTypes.map((t) => (
                    <option key={t} value={t}>
                      {MEAL_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="saved-meal-name" className={LABEL}>
                  Ad
                </label>
                <input
                  id="saved-meal-name"
                  value={name}
                  placeholder={`${MEAL_TYPE_LABELS[chosenType as MealType] ?? ""} · ${formatDateTr(date, { short: true })}`}
                  onChange={(e) => setName(e.target.value)}
                  className={INPUT}
                />
              </div>
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => {
                  const mealType = chosenType as MealType;
                  const finalName = name.trim() || `${MEAL_TYPE_LABELS[mealType]} · ${formatDateTr(date, { short: true })}`;
                  save.mutate(
                    { name: finalName, date, mealType },
                    {
                      onSuccess: () => {
                        setName("");
                        setNotice(`"${finalName}" kaydedildi.`);
                      },
                    }
                  );
                }}
                className={`${BUTTON} col-span-2`}
              >
                Öğünü kaydet
              </button>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-bold text-slate-900">Kayıtlı öğünlerin</h4>
          {saved.data?.length ? (
            <ul className="space-y-2">
              {saved.data.map((meal) => (
                <SavedMealRow key={meal.id} meal={meal} date={date} hideNumbers={hideNumbers} onDone={setNotice} />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">{saved.isLoading ? "Yükleniyor..." : "Henüz kayıtlı öğünün yok."}</p>
          )}
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-bold text-slate-900">Dünden kopyala</h4>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="copy-meal-type" className={LABEL}>
                Kopyalanacak
              </label>
              <select id="copy-meal-type" value={copyType} onChange={(e) => setCopyType(e.target.value as MealType | "all")} className={INPUT}>
                <option value="all">Bütün gün</option>
                {MEAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MEAL_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={copy.isPending}
              onClick={() =>
                copy.mutate(
                  {
                    fromDate: addDaysToDateString(date, -1),
                    toDate: date,
                    ...(copyType === "all" ? {} : { mealType: copyType }),
                  },
                  { onSuccess: (r) => setNotice(`${r.copied} kayıt kopyalandı.`) }
                )
              }
              className={`${BUTTON} shrink-0`}
            >
              Dünden kopyala
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
