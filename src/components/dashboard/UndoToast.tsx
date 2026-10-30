"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { RotateCcw, X } from "lucide-react";

export interface UndoToastData {
  /** Her yeni bildirim için benzersiz anahtar (zamanlayıcı buna göre yeniden başlar). */
  key: string;
  name: string;
  action: "added" | "deleted";
}

interface UndoToastProps {
  toast: UndoToastData | null;
  onUndo: () => Promise<void> | void;
  onDismiss: () => void;
  durationMs?: number;
}

/**
 * "Geri Al" bildirimi. Süre dolunca kendini kapatır; zamanlayıcı bileşen içinde tutulur ve
 * yeni bildirim gelince veya bileşen kaldırılınca temizlenir (üst üste binen bildirimler
 * birbirini erken kapatmaz).
 */
export function UndoToast({ toast, onUndo, onDismiss, durationMs = 7000 }: UndoToastProps) {
  const [busy, setBusy] = useState(false);
  // Zamanlayıcı yalnız yeni bildirimde yeniden başlar; süre dolunca güncel onDismiss çağrılır.
  const dismissOnTimeout = useEffectEvent(() => onDismiss());

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => dismissOnTimeout(), durationMs);
    return () => clearTimeout(id);
  }, [toast, durationMs]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3"
    >
      <div className="text-xs">
        <span className="font-semibold text-brand-300">{toast.name}</span>{" "}
        {toast.action === "added" ? "başarıyla eklendi." : "öğünlerden kaldırıldı."}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onUndo();
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs transition-colors disabled:opacity-60"
      >
        <RotateCcw className="w-3.5 h-3.5" aria-hidden />
        <span>Geri Al</span>
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Bildirimi kapat"
        className="text-slate-400 hover:text-white p-0.5 transition-colors"
      >
        <X className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
}
