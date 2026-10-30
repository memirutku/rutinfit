"use client";

import { useEffect, useState } from "react";
import { Bell, Trash2 } from "lucide-react";
import { errorMessage } from "@/lib/client/api";
import { notificationPermission, requestNotificationPermission, sendSystemNotification, type NotificationPermissionState } from "@/lib/client/notify";
import { useDeleteReminder, useReminders, useSaveReminder } from "@/lib/client/queries/reminders";
import { useSupplements } from "@/lib/client/queries/supplements";
import { getLocalDateString } from "@/lib/date-utils";
import { MEAL_TYPES, MEAL_TYPE_LABELS, type MealType } from "@/lib/schemas/enums";
import { REMINDER_KIND_LABELS, TIMED_REMINDER_KINDS, type ReminderInput, type ReminderKind } from "@/lib/schemas/reminder";

const INPUT = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm";
const LABEL = "block text-xs font-semibold text-slate-600 mb-1";
const DAY_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export function daysLabel(days: string): string {
  if (days === "1234567") return "Her gün";
  if (days === "12345") return "Hafta içi";
  if (days === "67") return "Hafta sonu";
  return [...days].map((d) => DAY_SHORT[Number(d) - 1]).join(", ");
}

const PERMISSION_TEXT: Record<NotificationPermissionState, string> = {
  granted: "Sistem bildirimleri açık.",
  default: "Sistem bildirimleri için izin gerekiyor. İzin vermezsen hatırlatmalar yalnız uygulama içinde görünür.",
  denied: "Sistem bildirimleri kapalı. Sistem Ayarları › Bildirimler'den RutinFit'e izin verebilirsin; hatırlatmalar uygulama içinde görünmeye devam eder.",
  unsupported: "Bu ortam sistem bildirimlerini desteklemiyor; hatırlatmalar uygulama içinde görünür.",
};

/** F83: Hatırlatmalar (uygulama açıkken). Yapılmış işler için hatırlatma gelmez. */
export function RemindersSection() {
  const reminders = useReminders();
  const supplements = useSupplements(getLocalDateString());
  const save = useSaveReminder();
  const remove = useDeleteReminder();
  const [permission, setPermission] = useState<NotificationPermissionState | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [form, setForm] = useState({ kind: "water" as ReminderKind, time: "10:00", days: "1234567", mealType: "lunch" as MealType, supplementId: "", title: "" });
  const error = save.error ?? remove.error;

  useEffect(() => {
    notificationPermission().then(setPermission, () => setPermission("unsupported"));
  }, []);

  const toggleDay = (d: string) =>
    setForm((f) => ({ ...f, days: f.days.includes(d) ? f.days.replace(d, "") : [...f.days + d].sort().join("") }));

  const activeSupplements = supplements.data?.filter((s) => s.active) ?? [];
  const canAdd =
    !!form.time && form.days.length > 0 && (form.kind !== "supplement" || !!form.supplementId) && (form.kind !== "custom" || !!form.title.trim());

  function add() {
    const common = { time: form.time, days: form.days, ...(form.title.trim() ? { title: form.title.trim() } : {}) };
    const input =
      form.kind === "meal"
        ? { kind: "meal" as const, mealType: form.mealType, ...common }
        : form.kind === "supplement"
          ? { kind: "supplement" as const, supplementId: form.supplementId, ...common }
          : { kind: form.kind, ...common };
    save.mutate({ input: input as ReminderInput }, { onSuccess: () => setForm((f) => ({ ...f, title: "" })) });
  }

  async function test() {
    const ok = await sendSystemNotification("RutinFit", "Bildirimler çalışıyor.");
    setTestResult(ok ? "Deneme bildirimi gönderildi." : "Bildirim gönderilemedi; izin verilmemiş olabilir.");
  }

  return (
    <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Bell className="w-5 h-5 text-brand-600" />
        <h3 className="font-bold text-slate-900 text-base">Hatırlatmalar</h3>
      </div>
      <p className="text-xs text-slate-500">
        Hatırlatmalar RutinFit açıkken gelir. İş zaten yapıldıysa (tartı girildi, takviye alındı, öğün kaydedildi, su hedefi doldu) hatırlatma atlanır.
      </p>

      {permission && (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
          <p>{PERMISSION_TEXT[permission]}</p>
          <div className="flex flex-wrap gap-2">
            {permission === "default" && (
              <button
                type="button"
                onClick={() => requestNotificationPermission().then(setPermission)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold"
              >
                Bildirimlere izin ver
              </button>
            )}
            {permission === "granted" && (
              <button type="button" onClick={test} className="px-3 py-1.5 rounded-lg border border-slate-200 font-bold">
                Deneme bildirimi gönder
              </button>
            )}
          </div>
          {testResult && <p role="status">{testResult}</p>}
        </div>
      )}

      <ul className="divide-y divide-slate-100 text-sm">
        {reminders.data?.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 py-2">
            <span className={r.enabled ? "text-slate-800" : "text-slate-400"}>
              <span className="font-mono font-bold">
                {r.relative ? `${r.relative.anchor === "imsak" ? "İmsaktan" : "İftardan"} ${r.relative.offsetMinutes} dk önce` : r.time}
              </span>{" "}
              · {r.title} <span className="text-xs text-slate-500">· {daysLabel(r.days)}</span>
            </span>
            <span className="shrink-0 flex items-center gap-2">
              <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                <input type="checkbox" checked={r.enabled} onChange={(e) => save.mutate({ id: r.id, input: { enabled: e.target.checked } })} aria-label={`${r.title} açık`} />
                Açık
              </label>
              <button type="button" aria-label={`${r.title} hatırlatmasını sil`} onClick={() => remove.mutate(r.id)} className="p-1 text-slate-400 hover:text-rose-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </span>
          </li>
        ))}
        {reminders.data?.length === 0 && <li className="py-2 text-slate-500">Henüz hatırlatma yok.</li>}
      </ul>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
        <div>
          <label htmlFor="rem-kind" className={LABEL}>
            Tür
          </label>
          <select id="rem-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ReminderKind })} className={INPUT}>
            {TIMED_REMINDER_KINDS.map((k) => (
              <option key={k} value={k}>
                {REMINDER_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rem-time" className={LABEL}>
            Saat
          </label>
          <input id="rem-time" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className={INPUT} />
        </div>
        {form.kind === "meal" && (
          <div>
            <label htmlFor="rem-meal" className={LABEL}>
              Öğün
            </label>
            <select id="rem-meal" value={form.mealType} onChange={(e) => setForm({ ...form, mealType: e.target.value as MealType })} className={INPUT}>
              {MEAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MEAL_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        )}
        {form.kind === "supplement" && (
          <div>
            <label htmlFor="rem-supp" className={LABEL}>
              Takviye
            </label>
            <select id="rem-supp" value={form.supplementId} onChange={(e) => setForm({ ...form, supplementId: e.target.value })} className={INPUT}>
              <option value="">Seç</option>
              {activeSupplements.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="rem-title" className={LABEL}>
            Başlık {form.kind === "custom" ? "" : "(isteğe bağlı)"}
          </label>
          <input id="rem-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={INPUT} />
        </div>
        <div className="col-span-2 sm:col-span-3">
          <span className={LABEL}>Günler</span>
          <div role="group" aria-label="Günler" className="flex flex-wrap gap-1">
            {DAY_SHORT.map((name, i) => {
              const d = String(i + 1);
              const on = form.days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(d)}
                  className={`px-2 py-1 rounded-lg border text-xs font-semibold ${on ? "bg-brand-50 border-brand-300 text-brand-800" : "bg-white border-slate-200 text-slate-500"}`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
        <button type="button" disabled={!canAdd || save.isPending} onClick={add} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50">
          Hatırlatma ekle
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-rose-700">
          {errorMessage(error, "İşlem yapılamadı.")}
        </p>
      )}
    </section>
  );
}
