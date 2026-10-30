"use client";

import { Calendar, Edit2, Trash2 } from "lucide-react";
import { formatAmount, formatDateTr } from "@/lib/format";
import type { PantryItem } from "@/lib/schemas/pantry";

interface PantryItemCardProps {
  item: PantryItem;
  onEdit: () => void;
  onDelete: () => void;
  /** +1 artır, -1 azalt (adım birime göre sayfada hesaplanır). */
  onAdjust: (direction: 1 | -1) => void;
}

/** Kilerdeki tek malzeme: kategori, ad, ± miktar çubuğu, SKT ve not. */
export function PantryItemCard({ item, onEdit, onDelete, onAdjust }: PantryItemCardProps) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-shadow shadow-2xs space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">{item.category}</span>
          <h4 className="font-bold text-slate-900 text-sm mt-1">{item.name}</h4>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            aria-label={`${item.name} öğesini düzenle`}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            aria-label={`${item.name} öğesini sil`}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Miktar Ayar Çubuğu */}
      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
        <span className="text-xs text-slate-500 font-medium">Stok Miktarı:</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAdjust(-1)}
            aria-label={`${item.name} miktarını azalt`}
            className="w-6 h-6 flex items-center justify-center bg-white border border-slate-200 rounded text-slate-600 text-xs font-bold hover:bg-slate-100"
          >
            -
          </button>
          <span className="font-bold text-sm text-slate-900">{formatAmount(item.amount, item.unit)}</span>
          <button
            onClick={() => onAdjust(1)}
            aria-label={`${item.name} miktarını artır`}
            className="w-6 h-6 flex items-center justify-center bg-white border border-slate-200 rounded text-slate-600 text-xs font-bold hover:bg-slate-100"
          >
            +
          </button>
        </div>
      </div>

      {/* Son Kullanma & Notlar */}
      {(item.expiryDate || item.notes) && (
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          {item.expiryDate ? (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              SKT: {formatDateTr(item.expiryDate)}
            </span>
          ) : (
            <span />
          )}
          {item.notes && <span className="italic truncate max-w-[150px]">{item.notes}</span>}
        </div>
      )}
    </div>
  );
}
