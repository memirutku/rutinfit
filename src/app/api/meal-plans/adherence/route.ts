import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, HttpError } from "@/lib/api-error";
import { ADHERENCE_VALUES, computeAdherence } from "@/lib/adherence";
import { isDateString } from "@/lib/date-utils";

const PatchSchema = z.object({
  plannedMealId: z.string().min(1),
  adherence: z.enum(ADHERENCE_VALUES).nullable(),
});

/** F78: GET ?from=&to= — tarih aralığındaki planlı öğünlerin uyum özeti. */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";
    if (!isDateString(from) || !isDateString(to)) throw new HttpError("from ve to YYYY-AA-GG biçiminde olmalıdır.", 400);
    const meals = await prisma.plannedMeal.findMany({
      where: { mealPlan: { date: { gte: from, lte: to } } },
      select: { adherence: true },
    });
    return NextResponse.json(computeAdherence(meals));
  } catch (error) {
    return apiError(error, "Uyum özeti getirilemedi", "Adherence GET");
  }
}

/** F78: Planlı öğünü uygulandı / kısmen / atlandı olarak işaretler (null işareti kaldırır). */
export async function PATCH(req: Request) {
  try {
    const { plannedMealId, adherence } = PatchSchema.parse(await req.json());
    const updated = await prisma.plannedMeal.update({
      where: { id: plannedMealId },
      data: { adherence, isCompleted: adherence === "done" || adherence === "partial" },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error, "Öğün işaretlenemedi", "Adherence PATCH");
  }
}
