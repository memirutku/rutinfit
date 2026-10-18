import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { calculateDailySummary } from "@/lib/nutrition-calculator";

const FoodLogCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().default("12:00"),
  mealType: z.enum(["breakfast", "lunch", "workSnack", "dinner", "extra"]),
  foodItemId: z.string().optional().nullable(),
  recipeId: z.string().optional().nullable(),
  name: z.string().min(1),
  grams: z.number().positive(),
  caloriesSnapshot: z.number().nonnegative(),
  proteinSnapshot: z.number().nonnegative(),
  carbsSnapshot: z.number().nonnegative(),
  fatSnapshot: z.number().nonnegative(),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date =
      searchParams.get("date") || new Date().toISOString().split("T")[0];

    const logs = await prisma.foodLog.findMany({
      where: { date },
      orderBy: { createdAt: "asc" },
      include: {
        foodItem: true,
        recipe: true,
      },
    });

    const profile = await prisma.userProfile.findUnique({
      where: { id: "default-user" },
    });

    const targets = profile
      ? {
          calorieTarget: profile.calorieTarget,
          calorieCeiling: profile.calorieCeiling,
          proteinTargetG: profile.proteinTargetG,
          fatTargetG: profile.fatTargetG,
          carbTargetG: profile.carbTargetG,
        }
      : {
          calorieTarget: 2080,
          calorieCeiling: 2100,
          proteinTargetG: 165,
          fatTargetG: 60,
          carbTargetG: 220,
        };

    const summary = calculateDailySummary(
      logs.map((l) => ({
        calories: l.caloriesSnapshot,
        proteinG: l.proteinSnapshot,
        carbsG: l.carbsSnapshot,
        fatG: l.fatSnapshot,
      })),
      targets
    );

    return NextResponse.json({
      date,
      logs,
      summary,
      targets,
    });
  } catch (error) {
    console.error("FoodLog GET error:", error);
    return NextResponse.json(
      { error: "Kayıtlar getirilemedi" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = FoodLogCreateSchema.parse(body);

    const created = await prisma.foodLog.create({
      data: validated,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error("FoodLog POST error:", error);
    return NextResponse.json(
      { error: error.message || "Öğün kaydedilemedi" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id zorunludur" }, { status: 400 });
    }

    await prisma.foodLog.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("FoodLog DELETE error:", error);
    return NextResponse.json(
      { error: "Kayıt silinemedi" },
      { status: 500 }
    );
  }
}
