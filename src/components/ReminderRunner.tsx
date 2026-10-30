"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import { sendSystemNotification } from "@/lib/client/notify";
import type { DueReminder } from "@/lib/schemas/reminder";

/**
 * F83: Uygulama açıkken dakikada bir vakti gelen hatırlatmaları sorar. Her biri sistem bildirimi
 * olarak gösterilir (izin varsa) ve ekranın köşesinde de görünür; sunucuda "bugün gösterildi"
 * olarak işaretlenir.
 */
export function ReminderRunner({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const [shown, setShown] = useState<DueReminder[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const { due } = await apiFetch<{ due: DueReminder[] }>("/api/reminders/due");
        if (cancelled || !due.length) return;
        await apiFetch("/api/reminders/fired", { method: "POST", json: { ids: due.map((d) => d.id) } });
        for (const d of due) await sendSystemNotification(d.title, d.body);
        if (!cancelled) setShown((prev) => [...prev.filter((p) => !due.some((d) => d.id === p.id)), ...due].slice(-3));
      } catch {
        // Sunucu geçici olarak yanıt vermezse bir sonraki dakikada yeniden denenir.
      }
    }
    void tick();
    const timer = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs]);

  if (!shown.length) return null;
  return (
    <div aria-live="polite" className="print:hidden fixed z-50 bottom-24 md:bottom-6 right-4 left-4 sm:left-auto sm:w-80 space-y-2">
      {shown.map((r) => (
        <div key={r.id} role="status" className="flex items-start gap-3 p-3 rounded-xl bg-white border border-brand-200 shadow-lg">
          <BellRing className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" aria-hidden />
          <div className="flex-1 min-w-0 text-sm">
            <p className="font-bold text-slate-900">{r.title}</p>
            {r.body && <p className="text-xs text-slate-600">{r.body}</p>}
          </div>
          <button type="button" aria-label={`${r.title} hatırlatmasını kapat`} onClick={() => setShown((s) => s.filter((x) => x.id !== r.id))} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
