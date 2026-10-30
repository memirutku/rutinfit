"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Info, Package, Plus, RefreshCw, Trash2 } from "lucide-react";
import { errorMessage } from "@/lib/client/api";
import { useAddShoppingItem, useDeleteShoppingItem, useRegenerateShopping, useToggleShoppingItem } from "@/lib/client/queries/shopping";
import { formatAmount, formatDateTr } from "@/lib/format";
import { DecimalInput } from "@/components/ui/DecimalInput";
import type { ShoppingList, ShoppingListItem } from "@/lib/schemas/shopping";

interface ShoppingListTabProps {
  /** Haftası listelenecek tarih (hafta başı sunucuda hesaplanır). */
  weekDate: string;
  /**
   * Sayfanın useShoppingList(weekDate) sonucu. Liste sayfa açılınca bir kez yüklenir;
   * sekme kendi sorgusunu açmaz (açsaydı GET otomatik kurulumun kiler özetini silerdi).
   */
  list: ShoppingList | undefined;
  isLoading: boolean;
  onMessage: (text: string, ms?: number) => void;
}

const MANUAL_UNITS = ["adet", "paket", "g", "kg", "ml", "l"] as const;
const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";
/** Notta en çok bu kadar öğün adı yazılır; kalanı sayıyla belirtilir. */
const MAX_NAMED = 4;

/** B09: tarife bağlı olmayan planlı öğünler neden listeye girmedi. */
function UnlinkedNote({ names }: { names: string[] }) {
  const shown = names.slice(0, MAX_NAMED);
  const rest = names.length - shown.length;
  return (
    <div role="note" aria-label="Listeye girmeyen öğünler" className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex gap-2.5">
      <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" aria-hidden />
      <div className="space-y-1">
        <p className="font-semibold">
          Bu hafta {names.length} öğün tarife bağlı değil; malzemeleri bilinmediği için listeye girmedi.
        </p>
        <p className="break-words">
          {shown.map((n) => `“${n}”`).join(" · ")}
          {rest > 0 && ` ve ${rest} öğün daha`}
        </p>
        <p className="text-amber-800">Hafta sekmesinde öğüne bir tarif seçebilir ya da gerekenleri aşağıdan elle ekleyebilirsin.</p>
      </div>
    </div>
  );
}

/**
 * Haftalık alışveriş listesi. İşaretler iyimser güncellenir: satır anında değişir,
 * sunucu hata verirse eski haline döner ve bildirim gösterilir. B09: elle kalem eklenebilir.
 */
export function ShoppingListTab({ weekDate, list: data, isLoading, onMessage }: ShoppingListTabProps) {
  const toggle = useToggleShoppingItem(weekDate);
  const regenerate = useRegenerateShopping(weekDate);
  const addItem = useAddShoppingItem(weekDate);
  const deleteItem = useDeleteShoppingItem(weekDate);
  const [draft, setDraft] = useState({ name: "", amount: 1, unit: "adet" });
  const loading = isLoading || regenerate.isPending;

  function handleToggle(item: ShoppingListItem) {
    toggle.mutate(
      { id: item.id, checked: !item.checked },
      { onError: (e) => onMessage(`Alışveriş kalemi güncellenemedi: ${errorMessage(e)}`, 4000) }
    );
  }

  function handleRefresh() {
    regenerate.mutate(undefined, {
      onSuccess: () => onMessage("Alışveriş listesi kiler stokları düşülerek güncellendi! ✓", 3000),
      onError: (e) => onMessage(`Alışveriş listesi yenilenemedi: ${errorMessage(e)}`, 4000),
    });
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    addItem.mutate(
      { name, amount: draft.amount > 0 ? draft.amount : 1, unit: draft.unit },
      {
        onSuccess: () => setDraft({ name: "", amount: 1, unit: draft.unit }),
        onError: (err) => onMessage(`Kalem eklenemedi: ${errorMessage(err)}`, 4000),
      }
    );
  }

  function handleDelete(item: ShoppingListItem) {
    deleteItem.mutate(item.id, { onError: (err) => onMessage(`Kalem silinemedi: ${errorMessage(err)}`, 4000) });
  }

  const groups = data?.grouped ? Object.entries(data.grouped) : [];
  const unlinked = data?.unlinkedMeals ?? [];
  const emptyText =
    data?.plannedMeals === 0
      ? "Bu hafta planlı öğün yok. Hafta sekmesinden öğün ekleyince tarif malzemeleri burada toplanır; istersen aşağıdan elle de kalem ekleyebilirsin."
      : "Bu hafta için henüz malzeme listesi bulunmuyor.";

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Haftalık Alışveriş Listesi 🛒</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Haftalık yemek planındaki tarif malzemeleri toplanıp kategori bazlı tekilleştirilmiştir. Elle eklediğin kalemler yenilemede silinmez.
          </p>
        </div>
        <span className="text-xs bg-brand-50 text-brand-700 font-semibold px-3 py-1.5 rounded-full border border-brand-200">
          Hafta: {formatDateTr(data?.weekStart ?? weekDate)}
        </span>
      </div>

      {/* Kiler Envanteri Özeti ve Yenileme Butonu (Pantry Host entegrasyonu) */}
      <div className="p-3.5 bg-brand-50/70 border border-brand-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-brand-900 font-medium">
          <Package className="w-4 h-4 text-brand-600 shrink-0" />
          <span>{data?.pantrySummary || "Evdeki kiler stoklarınız bu alışveriş listesinden otomatik düşülür."}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/pantry" className="font-bold underline text-brand-700 hover:text-brand-900">
            Kilerime Git →
          </Link>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-brand-200 hover:bg-brand-50 text-brand-700 rounded-lg font-bold shadow-2xs transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Kileri Düşerek Yenile</span>
          </button>
        </div>
      </div>

      {!loading && unlinked.length > 0 && <UnlinkedNote names={unlinked} />}

      {loading ? (
        <p className="text-sm text-slate-400">Yükleniyor...</p>
      ) : groups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {groups.map(([category, items]) => (
            <div key={category} className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <h4 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-600" />
                {category}
              </h4>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-1">
                    <div
                      onClick={() => handleToggle(item)}
                      role="checkbox"
                      aria-checked={item.checked}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          handleToggle(item);
                        }
                      }}
                      className={`flex-1 min-w-0 flex items-center justify-between gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                        item.checked
                          ? "bg-slate-100/70 text-slate-400 line-through"
                          : "bg-white hover:bg-slate-100 text-slate-800 border border-slate-100 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.checked ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                        <span className="text-sm font-medium break-words">{item.name}</span>
                        {item.manual && <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 no-underline">elle</span>}
                      </div>
                      <span className="text-xs font-bold text-slate-600 shrink-0">{formatAmount(item.amount, item.unit)}</span>
                    </div>
                    {item.manual && (
                      <button
                        type="button"
                        aria-label={`${item.name} sil`}
                        onClick={() => handleDelete(item)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400 text-sm">{emptyText}</div>
      )}

      {/* B09: elle kalem ekleme (tarife bağlı olmayan öğünler ya da plan dışı ihtiyaçlar) */}
      <form onSubmit={handleAdd} aria-label="Elle kalem ekle" className="grid grid-cols-2 sm:grid-cols-[1fr_6rem_6rem_auto] gap-2 items-end border-t border-slate-100 pt-4">
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="shopping-manual-name" className="block text-xs font-semibold text-slate-600 mb-1">
            Kalem adı
          </label>
          <input
            id="shopping-manual-name"
            value={draft.name}
            maxLength={80}
            placeholder="Örn: Laktozsuz yoğurt"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="shopping-manual-amount" className="block text-xs font-semibold text-slate-600 mb-1">
            Miktar
          </label>
          <DecimalInput id="shopping-manual-amount" value={draft.amount} onValueChange={(v) => setDraft({ ...draft, amount: v })} className={INPUT} />
        </div>
        <div>
          <label htmlFor="shopping-manual-unit" className="block text-xs font-semibold text-slate-600 mb-1">
            Birim
          </label>
          <select id="shopping-manual-unit" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} className={INPUT}>
            {MANUAL_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={!draft.name.trim() || addItem.isPending}
          className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden />
          Kalemi ekle
        </button>
      </form>
    </div>
  );
}
