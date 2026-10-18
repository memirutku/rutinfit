import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const UpdateProfileSchema = z.object({
  heightCm: z.number().positive(),
  age: z.number().int().positive(),
  sex: z.string(),
  currentWeightKg: z.number().positive(),
  calorieTarget: z.number().positive(),
  calorieCeiling: z.number().positive(),
  proteinTargetG: z.number().positive(),
  fatTargetG: z.number().positive(),
  carbTargetG: z.number().positive(),
  wakeTime: z.string(),
  workdayHomeTime: z.string(),
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
          calorieTarget: 2080,
          calorieCeiling: 2100,
          proteinTargetG: 165,
          fatTargetG: 60,
          carbTargetG: 220,
          wakeTime: "06:00",
          workdayHomeTime: "19:30",
          isOnboarded: true,
        },
      });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json({ error: "Profil getirilemedi" }, { status: 500 });
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
  } catch (error: any) {
    console.error("Profile PUT error:", error);
    return NextResponse.json(
      { error: error.message || "Profil güncellenemedi" },
      { status: 400 }
    );
  }
}
