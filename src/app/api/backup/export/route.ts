import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocalDateString } from "@/lib/date-utils";

export async function GET() {
  try {
    const profile = await prisma.userProfile.findFirst();
    const foods = await prisma.foodItem.findMany();
    const recipes = await prisma.recipe.findMany({
      include: { ingredients: true },
    });
    const mealPlans = await prisma.mealPlan.findMany({
      include: { meals: true },
    });
    const foodLogs = await prisma.foodLog.findMany();
    const workoutTemplates = await prisma.workoutTemplate.findMany({
      include: { exercises: true },
    });
    const workoutSessions = await prisma.workoutSession.findMany({
      include: { setLogs: true },
    });
    const weightLogs = await prisma.weightLog.findMany();
    const measurements = await prisma.bodyMeasurement.findMany();
    const wellbeings = await prisma.dailyWellbeing.findMany();
    const supplementLogs = await prisma.supplementLog.findMany();
    const shoppingListItems = await prisma.shoppingListItem.findMany();
    const pantryItems = await prisma.pantryItem.findMany();
    const aiSettings = await prisma.aISettings.findFirst();

    const backup = {
      version: "1.1",
      exportedAt: new Date().toISOString(),
      data: {
        profile,
        foods,
        recipes,
        mealPlans,
        foodLogs,
        workoutTemplates,
        workoutSessions,
        weightLogs,
        measurements,
        wellbeings,
        supplementLogs,
        shoppingListItems,
        pantryItems,
        aiSettings,
      },
    };

    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="rutinfit-backup-${getLocalDateString()}.json"`,
      },
    });
  } catch (error) {
    console.error("Backup export error:", error);
    return NextResponse.json(
      { error: "Yedek dışa aktarılamadı" },
      { status: 500 }
    );
  }
}
