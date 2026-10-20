"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { errorMessage } from "@/lib/client/api";
import { clientId } from "@/lib/client/keys";
import { useCreateRecipe } from "@/lib/client/queries/nutrition";
import type { FoodItem } from "@/lib/schemas/food";

interface IngredientRow {
  /** Satırın React anahtarı (sunucuya gönderilmez). */
  key: string;
  foodItemId: string;
  grams: number;
}

const newRow = (): IngredientRow => ({ key: clientId("ing"), foodItemId: "", grams: 100 });

const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";
const LABEL = "block text-xs font-semibold text-slate-700 mb-1";

interface NewRecipeModalProps {
  open: boolean;
  onClose: () => void;
  foods: FoodItem[];
}

/**
 * Yeni tarif formu: malzeme seçimi ve gramaj. Toplam makrolar sunucuda katalogdan
 * hesaplanır. Kayıt başarısız olursa mesaj gösterilir ve pencere açık kalır.
 */
export function NewRecipeModal({ open, onClose, foods }: NewRecipeModalProps) {
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [prepMinutes, setPrepMinutes] = useState(15);
  const [servings, setServings] = useState(1);
  const [ingredients, setIngredients] = useState<IngredientRow[]>(() => [newRow()]);
  const [error, setError] = useState<string | null>(null);
  const createRecipe = useCreateRecipe();

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const updateRow = (key: string, patch: Partial<Omit<IngredientRow, "key">>) =>
    setIngredients((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valid = ingredients
      .filter((i) => i.foodItemId && i.grams > 0)
      .map(({ foodItemId, grams }) => ({ foodItemId, grams }));
    if (valid.length === 0) return;

    setError(null);
    try {
      await createRecipe.mutateAsync({ name, instructions, prepMinutes, servings, ingredients: valid });
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Tarif oluşturulamadı."));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Yeni Tarif Oluştur"
      description="Malzemeleri seçin ve gramaj girin; toplam makrolar otomatik hesaplanacaktır."
      widthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="food-field-7" className={LABEL}>
            Tarif Adı
          </label>
          <input
            id="food-field-7"
            type="text"
            required
            placeholder="örn: Fırında Somon & Patates"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={INPUT}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="food-field-8" className={LABEL}>
              Hazırlama Süresi (dk)
            </label>
            <input
              id="food-field-8"
              type="number"
              value={prepMinutes}
              onChange={(e) => setPrepMinutes(parseInt(e.target.value) || 15)}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="food-field-9" className={LABEL}>
              Porsiyon Adedi
            </label>
            <input
              id="food-field-9"
              type="number"
              value={servings}
              onChange={(e) => setServings(parseInt(e.target.value) || 1)}
              className={INPUT}
            />
          </div>
        </div>

        <div>
          <label htmlFor="food-field-10" className={LABEL}>
            Tarif Notları / Pişirme Talimatı
          </label>
          <textarea
            id="food-field-10"
            rows={2}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className={INPUT}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-700">Malzemeler & Gramajlar</label>
            <button
              type="button"
              onClick={() => setIngredients((rows) => [...rows, newRow()])}
              className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Malzeme Ekle
            </button>
          </div>

          <div className="space-y-2">
            {ingredients.map((ing, idx) => (
              <div key={ing.key} className="flex gap-2 items-center">
                <select
                  aria-label={`Malzeme ${idx + 1}`}
                  value={ing.foodItemId}
                  onChange={(e) => updateRow(ing.key, { foodItemId: e.target.value })}
                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  required
                >
                  <option value="">Besin seçin</option>
                  {foods.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>

                <input
                  aria-label={`Malzeme ${idx + 1} gramajı`}
                  type="number"
                  min="1"
                  value={ing.grams}
                  onChange={(e) => updateRow(ing.key, { grams: parseFloat(e.target.value) || 0 })}
                  className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  placeholder="g"
                  required
                />
                <span className="text-xs text-slate-400">g</span>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100">
            İptal
          </button>
          <button
            type="submit"
            disabled={createRecipe.isPending}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Tarifi Kaydet
          </button>
        </div>
      </form>
    </Modal>
  );
}
