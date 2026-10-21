"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { PantryItem, PantryItemInput } from "@/lib/schemas/pantry";
import { PANTRY_ALL, PANTRY_CATEGORIES } from "./PantryFilters";

interface FormState {
  name: string;
  amount: string;
  unit: string;
  category: string;
  expiryDate: string;
  notes: string;
}

const EMPTY_FORM: FormState = { name: "", amount: "500", unit: "g", category: "Kuru Gıda", expiryDate: "", notes: "" };

function formFor(item: PantryItem | null): FormState {
  if (!item) return EMPTY_FORM;
  return {
    name: item.name,
    amount: String(item.amount),
    unit: item.unit,
    category: item.category,
    expiryDate: item.expiryDate || "",
    notes: item.notes || "",
  };
}

interface PantryItemModalProps {
  open: boolean;
  onClose: () => void;
  /** Düzenlenen öğe; null ise yeni malzeme eklenir. */
  editingItem: PantryItem | null;
  /** Sayfa kaydeder; başarıda pencereyi kapatır, hatada açık bırakıp hatayı gösterir. */
  onSubmit: (input: PantryItemInput) => Promise<void> | void;
}

/** Kilere malzeme ekleme / düzenleme penceresi. */
export function PantryItemModal({ open, onClose, editingItem, onSubmit }: PantryItemModalProps) {
  const [formData, setFormData] = useState<FormState>(() => formFor(editingItem));

  useEffect(() => {
    if (open) setFormData(formFor(editingItem));
  }, [open, editingItem]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.amount) return;
    await onSubmit({
      id: editingItem ? editingItem.id : undefined,
      name: formData.name.trim(),
      amount: parseFloat(formData.amount),
      unit: formData.unit,
      category: formData.category,
      expiryDate: formData.expiryDate || null,
      notes: formData.notes.trim() || null,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={editingItem ? "Malzemeyi Düzenle" : "Kilere Malzeme Ekle"}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label htmlFor="pantry-field-1" className="block text-xs font-bold text-slate-700 mb-1">Malzeme Adı *</label>
          <input
            id="pantry-field-1"
            type="text"
            required
            placeholder="örn: Yulaf Ezmesi, Tavuk Göğsü, Yumurta"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pantry-field-2" className="block text-xs font-bold text-slate-700 mb-1">Miktar *</label>
            <input
              id="pantry-field-2"
              type="number"
              step="any"
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label htmlFor="pantry-field-3" className="block text-xs font-bold text-slate-700 mb-1">Birim</label>
            <select
              id="pantry-field-3"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="g">Gram (g)</option>
              <option value="kg">Kilogram (kg)</option>
              <option value="ml">Mililitre (ml)</option>
              <option value="adet">Adet</option>
              <option value="paket">Paket</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pantry-field-4" className="block text-xs font-bold text-slate-700 mb-1">Kategori</label>
            <select
              id="pantry-field-4"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              {PANTRY_CATEGORIES.filter((c) => c !== PANTRY_ALL).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pantry-field-5" className="block text-xs font-bold text-slate-700 mb-1">SKT (İsteğe bağlı)</label>
            <input
              id="pantry-field-5"
              type="date"
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="pantry-field-6" className="block text-xs font-bold text-slate-700 mb-1">Not / Marka (İsteğe bağlı)</label>
          <input
            id="pantry-field-6"
            type="text"
            placeholder="örn: Buzlukta 2 paket var"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
          >
            İptal
          </button>
          <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 shadow-xs">
            {editingItem ? "Güncelle" : "Kaydet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
