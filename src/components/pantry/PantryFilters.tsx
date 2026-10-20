"use client";

import { Search } from "lucide-react";

export const PANTRY_ALL = "Tümü";

export const PANTRY_CATEGORIES = [
  PANTRY_ALL,
  "Kuru Gıda",
  "Süt Ürünleri",
  "Kasap/Balık",
  "Manav",
  "Baharat & Sos",
  "Atıştırmalık",
  "Diğer",
];

interface PantryFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (category: string) => void;
}

/** Kiler arama kutusu ve kategori filtreleri. */
export function PantryFilters({ search, onSearchChange, category, onCategoryChange }: PantryFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input
          type="text"
          placeholder="Kilerde ara (örn: Yulaf, Tavuk, Yumurta)..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-2xs"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
        {PANTRY_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              category === cat ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
