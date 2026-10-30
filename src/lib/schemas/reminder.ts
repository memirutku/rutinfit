import { z } from "zod";
import { MEAL_TYPES } from "./enums";

/** F83: Hatırlatma türleri. B26: sahur ve iftar, vakitten belirli dakika önce (Ramazan modunda). */
export const REMINDER_KINDS = ["meal", "water", "weigh", "supplement", "workout", "custom", "sahur", "iftar"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];
/** Saatle kurulan türler (hatırlatma formunda seçilebilenler). Sahur/iftar oruç kartından kurulur. */
export const TIMED_REMINDER_KINDS = ["meal", "water", "weigh", "supplement", "workout", "custom"] as const satisfies readonly ReminderKind[];
export const RELATIVE_REMINDER_KINDS = ["sahur", "iftar"] as const satisfies readonly ReminderKind[];

export const REMINDER_KIND_LABELS: Record<ReminderKind, string> = {
  meal: "Öğün",
  water: "Su",
  weigh: "Tartılma",
  supplement: "Takviye",
  workout: "Antrenman",
  custom: "Serbest",
  sahur: "Sahur",
  iftar: "İftar",
};

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saat SS:DD biçiminde olmalı.");
/** "1234567" gibi: her gün en çok bir kez, 1 = Pazartesi. */
const days = z
  .string()
  .regex(/^[1-7]{1,7}$/, "Gün seçimi geçersiz.")
  .refine((d) => new Set(d).size === d.length, "Gün seçimi geçersiz.")
  .transform((d) => [...d].sort().join(""));

const base = {
  title: z.string().trim().max(80).optional(),
  time,
  days: days.optional(),
  enabled: z.boolean().optional(),
};

export const ReminderInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("meal"), mealType: z.enum(MEAL_TYPES), ...base }),
  z.object({ kind: z.literal("supplement"), supplementId: z.string().min(1, "Takviye seçilmeli."), ...base }),
  z.object({ kind: z.literal("custom"), ...base, title: z.string().trim().min(1, "Başlık gerekli.").max(80) }),
  z.object({ kind: z.enum(["water", "weigh", "workout"]), ...base }),
  z.object({
    kind: z.enum(RELATIVE_REMINDER_KINDS),
    offsetMinutes: z.number().int().min(0).max(180),
    title: base.title,
    days: base.days,
    enabled: base.enabled,
  }),
]);
export type ReminderInput = z.infer<typeof ReminderInputSchema>;

/** Güncellemede tür değişmez; yalnız zaman, günler, başlık ve açık/kapalı. */
export const ReminderPatchSchema = z.object(base).partial();

export const ReminderFiredSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export interface Reminder {
  id: string;
  kind: ReminderKind;
  title: string;
  time: string;
  days: string;
  enabled: boolean;
  mealType: string | null;
  supplementId: string | null;
  /** B26: sahur/iftar türünde vakte göre (time anlamsızdır). */
  relative: { anchor: "imsak" | "iftar"; offsetMinutes: number } | null;
}

export interface DueReminder {
  id: string;
  kind: ReminderKind;
  title: string;
  body: string;
}
