import { AlertCircle, Check } from "lucide-react";
import type { FoodsNotice } from "./constants";

/** Kataloğa kaydetme / öğün ekleme sonrası kısa bildirim. */
export function ActionNotice({ notice }: { notice: FoodsNotice | null }) {
  if (!notice) return null;
  const success = notice.type === "success";
  return (
    <div
      className={`p-3.5 rounded-xl border text-sm font-semibold flex items-center gap-2 ${
        success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
      }`}
    >
      {success ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
      <span>{notice.text}</span>
    </div>
  );
}
