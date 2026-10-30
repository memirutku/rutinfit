/**
 * B41: Hatırlatmalar telefona ulaşsın diye takvim dosyası. Her açık hatırlatma haftalık
 * tekrarlanan, alarmlı bir etkinlik olur. Saatler "kayan" yerel saattir (TZID ve Z yok):
 * takvim uygulaması etkinliği bulunduğu saat diliminde aynı saatte gösterir.
 *
 * Takvim, iş yapılmış olsa da hatırlatır (uygulama içi hatırlatmadaki "yapıldıysa atla" kuralı
 * takvime taşınamaz). İmsak ve iftara bağlı hatırlatmaların saati her gün değiştiği için dosyaya
 * girmez; nedeni takvim açıklamasında yazar.
 */
import { addDaysToDateString, appTimeZone, getLocalDateString, getLocalWeekday } from "./date-utils";
import { escapeIcsText, icsUtcStamp, serializeIcs } from "./ics";
import type { Reminder } from "./schemas/reminder";

const BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

/** imsak/iftara göre kayan hatırlatma (B26): sabit saatli değildir. */
const isRelative = (r: Reminder) => (r as Reminder & { relative?: unknown }).relative != null;

/** Bugünden başlayarak hatırlatmanın seçili olduğu ilk gün. */
function firstDate(days: string, today: string, todayWeekday: number): string {
  for (let i = 0; i < 7; i++) {
    const weekday = ((todayWeekday - 1 + i) % 7) + 1;
    if (days.includes(String(weekday))) return addDaysToDateString(today, i);
  }
  return today;
}

export function remindersToIcs(reminders: Reminder[], opts: { now?: Date; timeZone?: string } = {}): string {
  const now = opts.now ?? new Date();
  const timeZone = opts.timeZone ?? appTimeZone();
  const today = getLocalDateString(now, timeZone);
  const todayWeekday = getLocalWeekday(now, timeZone);
  const stamp = icsUtcStamp(now);
  const active = reminders.filter((r) => r.enabled);
  const fixed = active.filter((r) => !isRelative(r) && /^\d{2}:\d{2}$/.test(r.time) && /^[1-7]+$/.test(r.days));
  const skippedRelative = active.some(isRelative);

  const description = [
    "RutinFit hatırlatmaları. Takvim, iş yapılmış olsa da hatırlatır; RutinFit açıkken gelen hatırlatma ise yapılan işi atlar.",
    skippedRelative
      ? "Sahur ve iftar hatırlatmaları imsak ve iftar vaktine göre her gün değiştiği için dosyaya eklenmedi; onlar RutinFit açıkken gelir."
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RutinFit//Hatirlatmalar//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText("RutinFit hatırlatmaları")}`,
    `X-WR-CALDESC:${escapeIcsText(description)}`,
  ];
  for (const r of fixed) {
    const date = firstDate(r.days, today, todayWeekday).replace(/-/g, "");
    const time = `${r.time.replace(":", "")}00`;
    const byDay = [...r.days].sort().map((d) => BYDAY[Number(d) - 1]).join(",");
    const summary = escapeIcsText(r.title);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${r.id}@rutinfit.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${date}T${time}`,
      "DURATION:PT5M",
      `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${escapeIcsText("RutinFit hatırlatması.")}`,
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${summary}`,
      "TRIGGER:PT0S",
      "END:VALARM",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return serializeIcs(lines);
}
