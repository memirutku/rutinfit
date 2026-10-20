import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { DEFAULT_TARGETS } from "@/lib/constants";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saat SS:DD biçiminde olmalıdır.");
// Hedef sütunları tam sayıdır: kesirli girişler yuvarlanır.
const intTarget = (min = 0) => z.number().finite().min(min).transform((v) => Math.round(v));

const UpdateProfileSchema = z.object({
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

export async function GET() {
  try {
    let profile = await prisma.userProfile.findUnique({
      where: { id: "default-user" },
    });

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          id: "default-user",
          heightCm: 181,
          age: 25,
          sex: "male",
          currentWeightKg: 112,
          ...DEFAULT_TARGETS,
          wakeTime: "06:00",
          workdayHomeTime: "19:30",
          isOnboarded: true,
        },
      });
    }

    return NextResponse.json(profile);
  } catch (error) {
    return apiError(error, "Profil getirilemedi", "Profile GET");
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const validated = UpdateProfileSchema.parse(body);

    const updated = await prisma.userProfile.upsert({
      where: { id: "default-user" },
      update: validated,
      create: {
        id: "default-user",
        ...validated,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error, "Profil güncellenemedi", "Profile PUT");
  }
}
