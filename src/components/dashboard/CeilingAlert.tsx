"use client";

import { AlertCircle } from "lucide-react";
import type { DailySummary } from "@/lib/schemas/food";

/** Sakin Üst Sınır Uyarısı: mesaj yoksa hiçbir şey çizmez. */
export function CeilingAlert({ alert }: { alert?: DailySummary["ceilingAlert"] }) {
  if (!alert?.message) return null;
  return (
    <div
      className={`p-4 rounded-xl border flex items-start gap-3 ${
        alert.isExceeded ? "bg-amber-50/80 border-amber-200 text-amber-900" : "bg-blue-50/80 border-blue-200 text-blue-900"
      }`}
    >
      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-semibold">{alert.isExceeded ? "Günlük Kalori Üst Sınırı" : "Hedef Hatırlatması"}</p>
        <p className="mt-0.5 opacity-90">{alert.message}</p>
      </div>
    </div>
  );
}
