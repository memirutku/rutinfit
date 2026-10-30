"use client";

import Link from "next/link";
import { CheckCircle2, Circle, Package, RefreshCw } from "lucide-react";
import { errorMessage } from "@/lib/client/api";
import { useRegenerateShopping, useToggleShoppingItem } from "@/lib/client/queries/shopping";
import { formatAmount, formatDateTr } from "@/lib/format";
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

/**
 * Haftalık alışveriş listesi. İşaretler iyimser güncellenir: satır anında değişir,
 * sunucu hata verirse eski haline döner ve bildirim gösterilir.
 */
export function ShoppingListTab({ weekDate, list: data, isLoading, onMessage }: ShoppingListTabProps) {
  const toggle = useToggleShoppingItem(weekDate);
  const regenerate = useRegenerateShopping(weekDate);
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

  const groups = data?.grouped ? Object.entries(data.grouped) : [];

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Haftalık Alışveriş Listesi 🛒</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Haftalık yemek planındaki tarif malzemeleri toplanıp kategori bazlı tekilleştirilmiştir.
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
                  <li
                    key={item.id}
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
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                      item.checked
                        ? "bg-slate-100/70 text-slate-400 line-through"
                        : "bg-white hover:bg-slate-100 text-slate-800 border border-slate-100 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {item.checked ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                      )}
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-600">{formatAmount(item.amount, item.unit)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400 text-sm">Bu hafta için henüz malzeme listesi bulunmuyor.</div>
      )}
    </div>
  );
}
