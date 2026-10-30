import { NextResponse } from "next/server";
import { UpdateProfileSchema } from "@/lib/schemas/profile";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { DEFAULT_TARGETS, NEW_PROFILE_DEFAULTS } from "@/lib/constants";
import { checkCalorieTarget } from "@/lib/safety";

export async function GET() {
  try {
    let profile = await prisma.userProfile.findUnique({
      where: { id: "default-user" },
    });

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          id: "default-user",
          // B02: nötr başlangıç; sihirbaz tamamlanana kadar hedefler "tahmini" gösterilir.
          ...NEW_PROFILE_DEFAULTS,
          ...DEFAULT_TARGETS,
          dayPattern: null,
          // F09: yeni kurulumda pano kurulum sihirbazını açar.
          isOnboarded: false,
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
    const { acknowledgeLowCalorie, ...validated } = UpdateProfileSchema.parse(body);

    // F56: taban altı hedef yalnız açık onayla kaydedilir.
    const check = checkCalorieTarget(validated.sex, validated.calorieTarget);
    if (!check.ok && !acknowledgeLowCalorie) {
      return NextResponse.json({ error: check.message, code: "LOW_CALORIE", floor: check.floor }, { status: 422 });
    }

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
