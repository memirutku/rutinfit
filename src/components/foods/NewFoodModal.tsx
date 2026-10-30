"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { errorMessage } from "@/lib/client/api";
import { useCreateFood } from "@/lib/client/queries/nutrition";
import { FOOD_CATEGORIES } from "./constants";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { formatNumberTr } from "@/lib/format";

interface NewFoodModalProps {
  open: boolean;
  onClose: () => void;
  /** Verilirse açılışta ad alanına yazılır (paketli gıda aramasından manuel ekleme). */
  prefillName?: string;
  /** F03: Open Food Facts'te bulunamayan barkod; form etiketten giriş modunda açılır. */
  prefillBarcode?: string;
  /** Kayıt başarılı olunca (pencere kapanmadan önce) çağrılır. */
  onCreated?: (food: { barcode: string | null; name: string }) => void;
}

/**
 * B14: Elle eklenen besin "Genel" kategoride ve "Kullanıcı" güveniyle başlar; değerler sıfırdır
 * (örnek değerler yanlışlıkla kaydedilmez, hurma "Kasap & Balık"a düşmez).
 */
const INITIAL_FORM = {
  name: "",
  category: "Genel",
  basisGrams: 100,
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  source: "Kullanıcı",
  confidence: "Kullanıcı",
  brand: "",
  barcode: "",
};

/** F03: Etiketten giriş: değerler sıfırdan başlar (yanlışlıkla örnek değer kaydedilmez). */
const LABEL_FORM = {
  ...INITIAL_FORM,
  name: "",
  category: "Paketli Gıda",
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  source: "Etiket",
  confidence: "Kullanıcı",
};

const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";
const LABEL = "block text-xs font-semibold text-slate-700 mb-1";

/**
 * Yeni besin formu. Form değerleri kapatıp açınca korunur; kayıt başarısız olursa
 * sunucunun mesajı gösterilir ve pencere açık kalır.
 */
export function NewFoodModal({ open, onClose, prefillName, prefillBarcode, onCreated }: NewFoodModalProps) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const createFood = useCreateFood();

  // Açılışta (ve açıkken ön ad değişince) hata silinir, ön ad yazılır. Effect yerine render
  // sırasında; açık gelen ilk render'da da uygulanır (`null` başlangıç).
  const [applied, setApplied] = useState<{ open: boolean; prefillName?: string; prefillBarcode?: string } | null>(null);
  if (!applied || applied.open !== open || applied.prefillName !== prefillName || applied.prefillBarcode !== prefillBarcode) {
    setApplied({ open, prefillName, prefillBarcode });
    if (open) {
      setError(null);
      if (prefillBarcode) setForm({ ...LABEL_FORM, barcode: prefillBarcode });
      else if (prefillName !== undefined) setForm((f) => ({ ...f, name: prefillName }));
    }
  }
  const labelMode = !!prefillBarcode;
  const per = `/${formatNumberTr(form.basisGrams)}g`;

  const num = (key: "calories" | "proteinG" | "carbsG" | "fatG") => (v: number) =>
    setForm((f) => ({ ...f, [key]: Math.max(0, v) }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createFood.mutateAsync({ ...form, brand: form.brand.trim() || null, barcode: form.barcode.trim() || null });
      onCreated?.({ barcode: form.barcode.trim() || null, name: form.name });
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Besin kaydedilemedi."));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={labelMode ? "Etiketten ürün ekle" : "Yeni Besin Ekle"}
      description={
        labelMode
          ? "Ambalajdaki besin değeri tablosunu gir. Bu barkod bir dahaki aramada yerel katalogdan bulunur."
          : "Doğru değerleri girin; tüm hesaplamalar bu değerlere dayanır."
      }
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

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="food-field-brand" className={LABEL}>
              Marka
            </label>
            <input
              id="food-field-brand"
              type="text"
              placeholder="İsteğe bağlı"
              value={form.brand}
              onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="food-field-barcode" className={LABEL}>
              Barkod
            </label>
            <input
              id="food-field-barcode"
              type="text"
              inputMode="numeric"
              placeholder="İsteğe bağlı"
              value={form.barcode}
              onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value.replace(/[^0-9]/g, "") }))}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="food-field-basis" className={LABEL}>
              Değerler kaç gram için?
            </label>
            <DecimalInput
              id="food-field-basis"
              required
              value={form.basisGrams}
              onValueChange={(v) => setForm((f) => ({ ...f, basisGrams: v > 0 ? v : 100 }))}
              className={INPUT}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="food-field-3" className={LABEL}>
              Kalori (kcal{per})
            </label>
            <DecimalInput id="food-field-3" required value={form.calories} onValueChange={num("calories")} className={INPUT} />
          </div>
          <div>
            <label htmlFor="food-field-4" className={LABEL}>
              Protein (g{per})
            </label>
            <DecimalInput
              id="food-field-4"
              required
              value={form.proteinG}
              onValueChange={num("proteinG")}
              className={INPUT}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="food-field-5" className={LABEL}>
              Karbonhidrat (g{per})
            </label>
            <DecimalInput
              id="food-field-5"
              required
              value={form.carbsG}
              onValueChange={num("carbsG")}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="food-field-6" className={LABEL}>
              Yağ (g{per})
            </label>
            <DecimalInput
              id="food-field-6"
              required
              value={form.fatG}
              onValueChange={num("fatG")}
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
