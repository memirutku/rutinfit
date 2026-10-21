import { z } from "zod";

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
});
export type ProfileInput = z.input<typeof UpdateProfileSchema>;

/** GET/PUT /api/profile yanıtı */
export const ProfileSchema = UpdateProfileSchema.extend({
  id: z.string(),
  isOnboarded: z.boolean(),
});
export type Profile = z.output<typeof ProfileSchema>;
