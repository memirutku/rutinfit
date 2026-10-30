import { describe, expect, it } from "vitest";
import { escapeIcsText, foldIcsLine } from "@/lib/ics";
import { remindersToIcs } from "@/lib/reminders-ics";
import type { Reminder } from "@/lib/schemas/reminder";

/** RFC 5545 için küçük bir okuyucu: satır katlamasını açar, özellikleri ve bileşenleri ayırır. */
function parseIcs(text: string) {
  expect(text.endsWith("\r\n")).toBe(true);
  const physical = text.slice(0, -2).split("\r\n");
  for (const line of physical) {
    expect(line.includes("\n") || line.includes("\r")).toBe(false);
    expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
  }
  const lines: string[] = [];
  for (const line of physical) {
    if (line.startsWith(" ")) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
  }
  type Comp = { name: string; props: Array<{ name: string; params: string; value: string }>; children: Comp[] };
  const root: Comp = { name: "ROOT", props: [], children: [] };
  const stack = [root];
  for (const line of lines) {
    const m = /^([A-Z-]+)((?:;[^:]*)?):(.*)$/.exec(line);
    expect(m, line).toBeTruthy();
    const [, name, params, value] = m!;
    if (name === "BEGIN") {
      const comp: Comp = { name: value, props: [], children: [] };
      stack[stack.length - 1].children.push(comp);
      stack.push(comp);
    } else if (name === "END") {
      expect(stack.pop()!.name).toBe(value);
    } else {
      stack[stack.length - 1].props.push({ name, params, value });
    }
  }
  expect(stack).toHaveLength(1);
  return root.children;
}

const unescape = (v: string) => v.replace(/\\(n|N|,|;|\\)/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));
const prop = (c: { props: Array<{ name: string; value: string }> }, name: string) => c.props.find((p) => p.name === name)?.value;

const reminder = (over: Partial<Reminder>): Reminder => ({
  id: "r1",
  kind: "custom",
  title: "Su iç",
  time: "09:00",
  days: "1234567",
  enabled: true,
  mealType: null,
  supplementId: null,
  ...over,
});

describe("B41: hatırlatmaları takvim dosyası (.ics) olarak dışa aktarma", () => {
  // 30 Ekim 2026 Cuma, İstanbul 16:57.
  const now = new Date("2026-10-30T13:57:24Z");

  it("her açık hatırlatma haftalık tekrarlı, yerel (kayan) saatli ve alarmlı bir etkinlik olur", () => {
    const ics = remindersToIcs(
      [
        reminder({ id: "r1", title: "Kreatin Monohidrat al", time: "09:00", days: "1234567" }),
        reminder({ id: "r2", title: "Tartılma zamanı", time: "07:30", days: "12345" }),
        reminder({ id: "r3", title: "Hafta sonu yürüyüşü", time: "10:15", days: "67" }),
        reminder({ id: "r4", title: "Kapalı", enabled: false }),
      ],
      { now, timeZone: "Europe/Istanbul" }
    );
    const [cal] = parseIcs(ics);
    expect(cal.name).toBe("VCALENDAR");
    expect(prop(cal, "VERSION")).toBe("2.0");
    expect(prop(cal, "PRODID")).toContain("RutinFit");
    const events = cal.children.filter((c) => c.name === "VEVENT");
    expect(events.map((e) => unescape(prop(e, "SUMMARY")!))).toEqual(["Kreatin Monohidrat al", "Tartılma zamanı", "Hafta sonu yürüyüşü"]);
    expect(new Set(events.map((e) => prop(e, "UID"))).size).toBe(3);
    expect(prop(events[0], "UID")).toBe("r1@rutinfit.local");
    for (const e of events) {
      expect(prop(e, "DTSTAMP")).toBe("20261030T135724Z");
      // Kayan saat: Z yok, TZID yok; telefon kendi saat diliminde aynı saatte gösterir.
      expect(prop(e, "DTSTART")).toMatch(/^\d{8}T\d{6}$/);
      expect(e.props.find((p) => p.name === "DTSTART")!.params).toBe("");
      expect(prop(e, "DURATION")).toBe("PT5M");
      const alarm = e.children.find((c) => c.name === "VALARM")!;
      expect(prop(alarm, "ACTION")).toBe("DISPLAY");
      expect(prop(alarm, "TRIGGER")).toBe("PT0S");
    }
    expect(prop(events[0], "RRULE")).toBe("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU");
    expect(prop(events[1], "RRULE")).toBe("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
    expect(prop(events[2], "RRULE")).toBe("FREQ=WEEKLY;BYDAY=SA,SU");
    // İlk tekrar: bugünden itibaren seçili ilk gün (Cuma 30 Ekim; hafta sonu için Cumartesi 31 Ekim).
    expect(prop(events[0], "DTSTART")).toBe("20261030T090000");
    expect(prop(events[1], "DTSTART")).toBe("20261030T073000");
    expect(prop(events[2], "DTSTART")).toBe("20261031T101500");
  });

  it("metin kaçışları (\\\\, ;, , ve satır sonu) ve 75 baytlık katlama çok baytlı harfleri bölmez", () => {
    const title = "Ilık su; limon, zencefil \\ bal\nsonra 10 dk yürü — ğüşıöç ĞÜŞİÖÇ ğüşıöç ĞÜŞİÖÇ ğüşıöç";
    const ics = remindersToIcs([reminder({ title })], { now, timeZone: "Europe/Istanbul" });
    const [cal] = parseIcs(ics);
    const event = cal.children.find((c) => c.name === "VEVENT")!;
    expect(prop(event, "SUMMARY")).toContain(String.raw`Ilık su\; limon\, zencefil \\ bal\nsonra`);
    expect(unescape(prop(event, "SUMMARY")!)).toBe(title);

    expect(escapeIcsText("a\\b;c,d\r\ne")).toBe(String.raw`a\\b\;c\,d\ne`);
    const folded = foldIcsLine(`SUMMARY:${"ş".repeat(60)}`);
    for (const part of folded.split("\r\n")) expect(Buffer.byteLength(part, "utf8")).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n").map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(`SUMMARY:${"ş".repeat(60)}`);
  });

  it("imsak/iftara bağlı (sahur, iftar) hatırlatmalar sabit saatli olmadığı için dosyaya girmez; takvim açıklaması nedenini söyler", () => {
    const relative = { ...reminder({ id: "sahur", title: "Sahur", time: "00:00" }), relative: { anchor: "imsak", offsetMinutes: 45 } } as Reminder;
    const ics = remindersToIcs([relative, reminder({ id: "su", title: "Su iç" })], { now, timeZone: "Europe/Istanbul" });
    const [cal] = parseIcs(ics);
    expect(cal.children.filter((c) => c.name === "VEVENT").map((e) => prop(e, "UID"))).toEqual(["su@rutinfit.local"]);
    expect(unescape(prop(cal, "X-WR-CALDESC")!)).toMatch(/Sahur ve iftar hatırlatmaları .*dosyaya eklenmedi/);
  });

  it("açık hatırlatma yoksa geçerli ama boş bir takvim üretir", () => {
    const [cal] = parseIcs(remindersToIcs([reminder({ enabled: false })], { now, timeZone: "Europe/Istanbul" }));
    expect(cal.children.filter((c) => c.name === "VEVENT")).toHaveLength(0);
  });
});
