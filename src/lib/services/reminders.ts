/**
 * F83: Hatırlatmalar. Sunucu "şu an gösterilecek" listesini hesaplar; arayüz dakikada bir sorar ve
 * sistem bildirimi gösterir. İş zaten yapıldıysa (tartı girildi, takviye alındı, öğün kaydedildi,
 * su hedefi doldu, antrenman tamamlandı) hatırlatma atlanır. Bir saatten eski hatırlatmalar
 * gösterilmez: uygulama akşam açılınca sabahın bildirimleri birikip gelmez.
 */
import { prisma } from "../prisma";
import { HttpError } from "../api-error";
import { getLocalDateString, getLocalTimeString, getLocalWeekday } from "../date-utils";
import { summarizeDrinks } from "../drinks";
import { formatNumberTr } from "../format";
import { MEAL_TYPE_LABELS, type MealType } from "../schemas/enums";
import type { DueReminder, Reminder, ReminderInput, ReminderKind } from "../schemas/reminder";
import { isRamadanFastingNow, ramadanStatus } from "./fasting";

/** Vakti geçen bir hatırlatma bu kadar dakika gösterilmeye devam eder. */
export const REMINDER_GRACE_MINUTES = 60;

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const isRelative = (kind: string) => kind === "sahur" || kind === "iftar";

const toView = (r: {
  id: string;
  kind: string;
  title: string;
  time: string;
  days: string;
  enabled: boolean;
  mealType: string | null;
  supplementId: string | null;
  offsetMinutes?: number | null;
}): Reminder => ({
  id: r.id,
  kind: r.kind as ReminderKind,
  title: r.title,
  time: r.time,
  days: r.days,
  enabled: r.enabled,
  mealType: r.mealType,
  supplementId: r.supplementId,
  relative: isRelative(r.kind) ? { anchor: r.kind === "sahur" ? "imsak" : "iftar", offsetMinutes: r.offsetMinutes ?? 0 } : null,
});

const hhmm = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export async function listReminders(): Promise<Reminder[]> {
  const rows = await prisma.reminder.findMany({ orderBy: [{ time: "asc" }, { createdAt: "asc" }] });
  return rows.map(toView);
}

async function defaultTitle(input: ReminderInput): Promise<string> {
  switch (input.kind) {
    case "meal":
      return `${MEAL_TYPE_LABELS[input.mealType]} zamanı`;
    case "supplement": {
      const s = await prisma.supplement.findUnique({ where: { id: input.supplementId } });
      if (!s) throw new HttpError("Takviye bulunamadı.", 404);
      return `${s.name} al`;
    }
    case "water":
      return "Su iç";
    case "weigh":
      return "Tartılma zamanı";
    case "workout":
      return "Antrenman zamanı";
    case "custom":
      return input.title;
    case "sahur":
      return "Sahur vakti yaklaşıyor";
    case "iftar":
      return "İftara az kaldı";
  }
}

export async function createReminder(input: ReminderInput): Promise<Reminder> {
  const fallback = await defaultTitle(input);
  const created = await prisma.reminder.create({
    data: {
      kind: input.kind,
      title: input.title?.trim() || fallback,
      // B26: sahur/iftar saati her gün imsak/iftardan hesaplanır; sütun boş kalmasın diye yer tutucu.
      time: "time" in input ? input.time : "00:00",
      offsetMinutes: "offsetMinutes" in input ? input.offsetMinutes : null,
      days: input.days ?? "1234567",
      enabled: input.enabled ?? true,
      mealType: input.kind === "meal" ? input.mealType : null,
      supplementId: input.kind === "supplement" ? input.supplementId : null,
    },
  });
  return toView(created);
}

export async function updateReminder(id: string, patch: { title?: string; time?: string; days?: string; enabled?: boolean }): Promise<Reminder> {
  const current = await prisma.reminder.findUnique({ where: { id } });
  if (!current) throw new HttpError("Hatırlatma bulunamadı.", 404);
  const data = { ...patch, ...(patch.title !== undefined && !patch.title.trim() ? { title: current.title } : {}) };
  return toView(await prisma.reminder.update({ where: { id }, data }));
}

export async function deleteReminder(id: string) {
  const res = await prisma.reminder.deleteMany({ where: { id } });
  if (res.count === 0) throw new HttpError("Hatırlatma bulunamadı.", 404);
}

export async function markRemindersFired(ids: string[], date = getLocalDateString()) {
  await prisma.reminder.updateMany({ where: { id: { in: ids } }, data: { lastFiredOn: date } });
}

export async function dueReminders(now = new Date()): Promise<DueReminder[]> {
  const today = getLocalDateString(now);
  const weekday = String(getLocalWeekday(now));
  const nowMin = minutes(getLocalTimeString(now));
  const enabled = await prisma.reminder.findMany({ where: { enabled: true } });
  // B26: sahur/iftar hatırlatmasının saati bugünün imsak/iftar vaktinden hesaplanır (yalnız Ramazan günlerinde).
  const ramadan = enabled.some((r) => isRelative(r.kind))
    ? await prisma.userProfile.findFirst().then((p) => (p ? ramadanStatus(p, now) : null))
    : null;
  const ramadanActive = !!ramadan && ramadan.period?.inRamadan !== false;
  const effectiveTime = (r: (typeof enabled)[number]): string | null => {
    if (!isRelative(r.kind)) return r.time;
    if (!ramadanActive) return null;
    const anchor = r.kind === "sahur" ? ramadan!.today.imsak : ramadan!.today.iftar;
    return hhmm(minutes(anchor) - (r.offsetMinutes ?? 0));
  };
  let candidates = enabled.filter((r) => {
    const time = effectiveTime(r);
    if (!time) return false;
    const age = nowMin - minutes(time);
    return r.days.includes(weekday) && r.lastFiredOn !== today && age >= 0 && age <= REMINDER_GRACE_MINUTES;
  });
  if (!candidates.length) return [];
  // F76: Ramazan modunda oruç saatlerinde su ve öğün hatırlatması gelmez.
  if (await isRamadanFastingNow(now)) {
    candidates = candidates.filter((r) => r.kind !== "water" && r.kind !== "meal");
    if (!candidates.length) return [];
  }

  const kinds = new Set(candidates.map((r) => r.kind));
  const [profile, drinks, weighed, meals, supplements, taken, workoutDone] = await Promise.all([
    kinds.has("water") ? prisma.userProfile.findFirst({ select: { waterTargetMl: true } }) : null,
    kinds.has("water") ? prisma.drinkLog.findMany({ where: { date: today } }) : [],
    kinds.has("weigh") ? prisma.weightLog.count({ where: { date: today } }) : 0,
    kinds.has("meal") ? prisma.foodLog.findMany({ where: { date: today }, select: { mealType: true }, distinct: ["mealType"] }) : [],
    kinds.has("supplement") ? prisma.supplement.findMany() : [],
    kinds.has("supplement") ? prisma.supplementLog.findMany({ where: { date: today, taken: true }, select: { name: true } }) : [],
    kinds.has("workout") ? prisma.workoutSession.count({ where: { date: today, completed: true } }) : 0,
  ]);
  const hydration = summarizeDrinks(drinks, profile?.waterTargetMl ?? 2500);
  const loggedMeals = new Set(meals.map((m) => m.mealType));
  const takenNames = new Set(taken.map((t) => t.name));

  const due: DueReminder[] = [];
  for (const r of candidates) {
    const kind = r.kind as ReminderKind;
    let body: string | null = null;
    switch (kind) {
      case "water":
        if (hydration.hydrationMl < hydration.waterTargetMl) {
          body = `Bugün ${formatNumberTr(hydration.hydrationMl)} / ${formatNumberTr(hydration.waterTargetMl)} ml içtin.`;
        }
        break;
      case "weigh":
        if (!weighed) body = "Aynı koşullarda (sabah, aç karnına) tartılıp kaydet.";
        break;
      case "meal":
        if (!loggedMeals.has(r.mealType ?? "")) body = `${MEAL_TYPE_LABELS[(r.mealType ?? "extra") as MealType]} öğününü kaydetmeyi unutma.`;
        break;
      case "supplement": {
        const s = supplements.find((x) => x.id === r.supplementId);
        if (s && s.active && !takenNames.has(s.name)) body = `${formatNumberTr(s.doseAmount)} ${s.doseUnit} ${s.name}`;
        break;
      }
      case "workout":
        if (!workoutDone) body = "Bugünkü antrenmanını yapıp kaydetmeyi unutma.";
        break;
      case "custom":
        body = "";
        break;
      case "sahur":
        body = `İmsak ${ramadan!.today.imsak}. Sahur için ${r.offsetMinutes ?? 0} dakika var.`;
        break;
      case "iftar":
        body = `İftar ${ramadan!.today.iftar}.`;
        break;
    }
    if (body !== null) due.push({ id: r.id, kind, title: r.title, body });
  }
  return due;
}
