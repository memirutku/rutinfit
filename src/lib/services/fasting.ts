/**
 * F76: Ramazan modu (il bazlı, internetsiz imsak/iftar) · F14: aralıklı oruç zamanlayıcısı.
 * Vakitler Türkiye saatiyle hesaplanır; bilgisayarın saat dilimi farklı olsa da aynı kalır.
 */
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../api-error";
import { addDaysToDateString, getLocalDateString, getLocalTimeString } from "../date-utils";
import { fastingTimes, findProvince, PROVINCES, type FastingTimes } from "../prayer-times";
import { formatNumberTr } from "../format";
import { ramadanInfo, type RamadanInfo } from "../ramadan-calendar";

const TR = "Europe/Istanbul";
const PROVINCE_NAMES = PROVINCES.map((p) => p.name) as [string, ...string[]];

export const FastingSettingsSchema = z.object({
  ramadanMode: z.boolean().optional(),
  ramadanProvince: z.enum(PROVINCE_NAMES, "Bilinmeyen il.").optional(),
  ramadanImsakAdjust: z.number().int().min(-30).max(30).optional(),
  ramadanIftarAdjust: z.number().int().min(-30).max(30).optional(),
  fastingTargetHours: z.number().int().min(12).max(23).nullable().optional(),
});
export type FastingSettings = z.infer<typeof FastingSettingsSchema>;

export const FastingStartSchema = z.object({ targetHours: z.number().int().min(12).max(23).optional() });

export interface RamadanStatus {
  province: string;
  today: FastingTimes;
  tomorrow: FastingTimes;
  /** sahur: imsaktan önce · fasting: oruçlu · evening: iftardan sonra */
  phase: "sahur" | "fasting" | "evening";
  minutesLeft: number;
  progressPercent: number | null;
  waterAdvice: string;
  /** B26: bugün Ramazan mı; değilse sıradakine kaç gün var (takvim hesaplanamazsa null). */
  period: RamadanInfo | null;
}

export interface FastingTimerStatus {
  targetHours: number | null;
  active: { id: string; startedAt: string; targetHours: number; elapsedMinutes: number; progressPercent: number } | null;
  recent: Array<{ id: string; startedAt: string; endedAt: string; targetHours: number; durationMinutes: number; reachedTarget: boolean }>;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

type RamadanProfile = { ramadanMode: boolean; ramadanProvince: string; ramadanImsakAdjust: number; ramadanIftarAdjust: number; waterTargetMl: number };

export function ramadanStatus(profile: RamadanProfile, now = new Date()): RamadanStatus | null {
  if (!profile.ramadanMode) return null;
  const province = findProvince(profile.ramadanProvince) ?? findProvince("İstanbul")!;
  const adjust = { imsak: profile.ramadanImsakAdjust, iftar: profile.ramadanIftarAdjust };
  const date = getLocalDateString(now, TR);
  const today = fastingTimes(province, date, adjust);
  const tomorrow = fastingTimes(province, addDaysToDateString(date, 1), adjust);
  const nowMin = toMin(getLocalTimeString(now, TR));
  const imsak = toMin(today.imsak);
  const iftar = toMin(today.iftar);

  let phase: RamadanStatus["phase"];
  let minutesLeft: number;
  let progressPercent: number | null = null;
  if (nowMin < imsak) {
    phase = "sahur";
    minutesLeft = imsak - nowMin;
  } else if (nowMin < iftar) {
    phase = "fasting";
    minutesLeft = iftar - nowMin;
    progressPercent = Math.round(((nowMin - imsak) / (iftar - imsak)) * 100);
  } else {
    phase = "evening";
    minutesLeft = 1440 - nowMin + toMin(tomorrow.imsak);
  }
  const windowHours = (1440 - iftar + toMin(tomorrow.imsak)) / 60;
  const perHour = Math.round(profile.waterTargetMl / windowHours / 50) * 50;
  const waterAdvice = `İftar ile sahur arasında ${formatNumberTr(profile.waterTargetMl)} ml hedefle: saatte yaklaşık ${formatNumberTr(perHour)} ml, bir kerede çok değil.`;
  return { province: province.name, today, tomorrow, phase, minutesLeft, progressPercent, waterAdvice, period: ramadanInfo(date) };
}

/** F83 ile: Ramazan modunda oruç saatlerinde su ve öğün hatırlatması gelmez (B26: yalnız Ramazan günlerinde). */
export async function isRamadanFastingNow(now = new Date()): Promise<boolean> {
  const profile = await prisma.userProfile.findFirst();
  if (!profile?.ramadanMode) return false;
  const status = ramadanStatus(profile, now);
  return status?.phase === "fasting" && status.period?.inRamadan !== false;
}

export async function getFastingStatus(now = new Date()): Promise<{ ramadan: RamadanStatus | null; timer: FastingTimerStatus }> {
  const [profile, active, recent] = await Promise.all([
    prisma.userProfile.findFirst(),
    prisma.fastingSession.findFirst({ where: { endedAt: null }, orderBy: { startedAt: "desc" } }),
    prisma.fastingSession.findMany({ where: { endedAt: { not: null } }, orderBy: { startedAt: "desc" }, take: 7 }),
  ]);
  const elapsed = active ? Math.max(0, Math.floor((now.getTime() - active.startedAt.getTime()) / 60000)) : 0;
  return {
    ramadan: profile ? ramadanStatus(profile, now) : null,
    timer: {
      targetHours: profile?.fastingTargetHours ?? null,
      active: active
        ? {
            id: active.id,
            startedAt: active.startedAt.toISOString(),
            targetHours: active.targetHours,
            elapsedMinutes: elapsed,
            progressPercent: Math.min(100, Math.round((elapsed / (active.targetHours * 60)) * 100)),
          }
        : null,
      recent: recent.map((s) => {
        const durationMinutes = Math.round((s.endedAt!.getTime() - s.startedAt.getTime()) / 60000);
        return {
          id: s.id,
          startedAt: s.startedAt.toISOString(),
          endedAt: s.endedAt!.toISOString(),
          targetHours: s.targetHours,
          durationMinutes,
          reachedTarget: durationMinutes >= s.targetHours * 60,
        };
      }),
    },
  };
}

export async function saveFastingSettings(input: FastingSettings) {
  const p = await prisma.userProfile.upsert({ where: { id: "default-user" }, update: input, create: { id: "default-user", ...input } });
  return {
    ramadanMode: p.ramadanMode,
    ramadanProvince: p.ramadanProvince,
    ramadanImsakAdjust: p.ramadanImsakAdjust,
    ramadanIftarAdjust: p.ramadanIftarAdjust,
    fastingTargetHours: p.fastingTargetHours,
  };
}

export async function startFast(targetHours?: number) {
  if (await prisma.fastingSession.findFirst({ where: { endedAt: null } })) throw new HttpError("Zaten süren bir oruç var.", 409);
  const profile = await prisma.userProfile.findFirst({ select: { fastingTargetHours: true } });
  return prisma.fastingSession.create({ data: { startedAt: new Date(), targetHours: targetHours ?? profile?.fastingTargetHours ?? 16 } });
}

export async function stopFast() {
  const active = await prisma.fastingSession.findFirst({ where: { endedAt: null }, orderBy: { startedAt: "desc" } });
  if (!active) throw new HttpError("Süren bir oruç yok.", 404);
  return prisma.fastingSession.update({ where: { id: active.id }, data: { endedAt: new Date() } });
}
