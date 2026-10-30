import { z } from "zod";
import { ACTIVITY_LEVEL_KEYS, GOAL_TYPES, type GoalType } from "../energy";

const GOAL_TYPE_KEYS = Object.keys(GOAL_TYPES) as [GoalType, ...GoalType[]];

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saat SS:DD biçiminde olmalıdır.");
// Hedef sütunları tam sayıdır: kesirli girişler yuvarlanır.
const intTarget = (min = 0) =>
  z
    .number()
    .finite()
    .min(min)
    .transform((v) => Math.round(v));

/** PUT /api/profile */
export const UpdateProfileSchema = z.object({
  heightCm: z.number().positive().max(260),
  age: z.number().int().positive().max(120),
  sex: z.enum(["male", "female"]),
  currentWeightKg: z.number().positive().max(400),
  calorieTarget: intTarget(1),
  calorieCeiling: intTarget(1),
  proteinTargetG: intTarget(),
  fatTargetG: intTarget(),
  carbTargetG: intTarget(),
  wakeTime: time,
  workdayHomeTime: time,
  isOnboarded: z.boolean().optional(),
  /** F56: kalori ve makro sayılarını gizle. */
  hideNumbers: z.boolean().optional(),
  /** F09: kurulum sihirbazı girdileri. */
  activityLevel: z.enum(ACTIVITY_LEVEL_KEYS as [string, ...string[]]).optional(),
  goalType: z.enum(GOAL_TYPE_KEYS).optional(),
  goalRateKgPerWeek: z.number().min(0).max(2).optional(),
  targetWeightKg: z.number().positive().max(400).nullable().optional(),
  /** F13: günlük sıvı hedefi (ml). */
  waterTargetMl: z.number().int().min(500).max(8000).optional(),
  /** F31: alışveriş listesi kaç kişilik. */
  householdSize: z.number().int().min(1).max(12).optional(),
  /** F52: koça notlar (alerji, sakatlık, ekipman). */
  coachNotes: z.string().max(1000).nullable().optional(),
  /** F82: günlük ritimde isteğe bağlı döngü notu. */
  cycleTracking: z.boolean().optional(),
  /** F56: tabanın altındaki hedef bilerek (sağlık profesyoneliyle) seçildi. Saklanmaz. */
  acknowledgeLowCalorie: z.boolean().optional(),
});
export type ProfileInput = z.input<typeof UpdateProfileSchema>;

/** GET/PUT /api/profile yanıtı */
export const ProfileSchema = UpdateProfileSchema.omit({ acknowledgeLowCalorie: true }).extend({
  id: z.string(),
  isOnboarded: z.boolean(),
  hideNumbers: z.boolean().optional(),
  /** F76 + F14: oruç ayarları (ayrı uçtan kaydedilir). */
  ramadanMode: z.boolean().optional(),
  ramadanProvince: z.string().optional(),
  ramadanImsakAdjust: z.number().int().optional(),
  ramadanIftarAdjust: z.number().int().optional(),
  fastingTargetHours: z.number().int().nullable().optional(),
});
export type Profile = z.output<typeof ProfileSchema>;
