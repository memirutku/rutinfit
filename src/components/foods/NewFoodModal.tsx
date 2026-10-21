"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { errorMessage } from "@/lib/client/api";
import { useCreateFood } from "@/lib/client/queries/nutrition";
import { FOOD_CATEGORIES } from "./constants";

interface NewFoodModalProps {
  open: boolean;
  onClose: () => void;
  /** Verilirse açılışta ad alanına yazılır (paketli gıda aramasından manuel ekleme). */
  prefillName?: string;
}

const INITIAL_FORM = {
  name: "",
  category: "Kasap & Balık",
  basisGrams: 100,
  calories: 120,
  proteinG: 20,
  carbsG: 0,
  fatG: 2,
  source: "Kullanıcı",
  confidence: "Yüksek",
};

const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";
const LABEL = "block text-xs font-semibold text-slate-700 mb-1";

/**
 * Yeni besin formu. Form değerleri kapatıp açınca korunur; kayıt başarısız olursa
 * sunucunun mesajı gösterilir ve pencere açık kalır.
 */
export function NewFoodModal({ open, onClose, prefillName }: NewFoodModalProps) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const createFood = useCreateFood();

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (prefillName !== undefined) setForm((f) => ({ ...f, name: prefillName }));
  }, [open, prefillName]);

  const num = (key: "calories" | "proteinG" | "carbsG" | "fatG") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: parseFloat(e.target.value) || 0 }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createFood.mutateAsync(form);
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Besin kaydedilemedi."));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Yeni Besin Ekle"
      description="100g bazında doğru değerleri girin; tüm hesaplamalar bu değerlere dayanır."
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label htmlFor="food-field-1" className={LABEL}>
            Besin Adı
          </label>
          <input
            id="food-field-1"
            type="text"
            required
            placeholder="örn: Hindi Göğsü, Tam Buğday Ekmeği"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={INPUT}
          />
        </div>

        <div>
          <label htmlFor="food-field-2" className={LABEL}>
            Kategori
          </label>
          <select
            id="food-field-2"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className={INPUT}
          >
            {FOOD_CATEGORIES.filter((c) => c !== "all").map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="food-field-3" className={LABEL}>
              Kalori (kcal/100g)
            </label>
            <input id="food-field-3" type="number" required value={form.calories} onChange={num("calories")} className={INPUT} />
          </div>
          <div>
            <label htmlFor="food-field-4" className={LABEL}>
              Protein (g/100g)
            </label>
            <input
              id="food-field-4"
              type="number"
              step="0.1"
              required
              value={form.proteinG}
              onChange={num("proteinG")}
              className={INPUT}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="food-field-5" className={LABEL}>
              Karbonhidrat (g/100g)
            </label>
            <input
              id="food-field-5"
              type="number"
              step="0.1"
              required
              value={form.carbsG}
              onChange={num("carbsG")}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="food-field-6" className={LABEL}>
              Yağ (g/100g)
            </label>
            <input
              id="food-field-6"
              type="number"
              step="0.1"
              required
              value={form.fatG}
              onChange={num("fatG")}
              className={INPUT}
            />
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
            disabled={createFood.isPending}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
          >
            Kaydet
          </button>
        </div>
      </form>
    </Modal>
  );
}
