"use client";

import { AlertCircle } from "lucide-react";
import type { DailySummary } from "@/lib/schemas/food";

/** Sakin Üst Sınır Uyarısı: mesaj yoksa hiçbir şey çizmez. */
export function CeilingAlert({ alert, hideNumbers = false }: { alert?: DailySummary["ceilingAlert"]; hideNumbers?: boolean }) {
  if (!alert?.message) return null;
  // F56: gizleme modunda sayı içeren mesaj yerine sakin, sayısız bir metin.
  const message = hideNumbers
    ? alert.isExceeded
      ? "Bugün planladığından fazla yedin. Sorun değil; bir sonraki öğünde planına dönmen yeterli."
      : "Bugünkü hedefine yaklaşıyorsun."
    : alert.message;
  return (
    <div
      className={`p-4 rounded-xl border flex items-start gap-3 ${
        alert.isExceeded ? "bg-amber-50/80 border-amber-200 text-amber-900" : "bg-blue-50/80 border-blue-200 text-blue-900"
      }`}
    >
      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-semibold">{alert.isExceeded ? "Günlük Kalori Üst Sınırı" : "Hedef Hatırlatması"}</p>
        <p className="mt-0.5 opacity-90">{message}</p>
      </div>
    </div>
  );
}
