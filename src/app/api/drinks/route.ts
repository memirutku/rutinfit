import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getLocalDateString, getLocalTimeString } from "@/lib/date-utils";
import { findDrinkPreset, summarizeDrinks } from "@/lib/drinks";
import { SUGAR_CUBE_G } from "@/lib/quick-foods";
import { DrinkInputSchema } from "@/lib/schemas/drinks";
import { formatNumberTr } from "@/lib/format";

/** F13: Günün içecekleri ve özeti (sıvı, kafein, alkol). */
export async function GET(req: Request) {
  try {
    const date = new URL(req.url).searchParams.get("date") || getLocalDateString();
    const [logs, profile] = await Promise.all([
      prisma.drinkLog.findMany({ where: { date }, orderBy: [{ time: "asc" }, { createdAt: "asc" }] }),
      prisma.userProfile.findFirst({ select: { waterTargetMl: true } }),
    ]);
    return NextResponse.json({ date, logs, summary: summarizeDrinks(logs, profile?.waterTargetMl ?? 2500) });
  } catch (error) {
    return apiError(error, "İçecekler getirilemedi", "Drinks GET");
  }
}

/** F13: İçecek ekler. Kalorili içecek (alkol, şekerli) besin günlüğüne de kalorisiyle yazılır. */
export async function POST(req: Request) {
  try {
    const input = DrinkInputSchema.parse(await req.json());
    const p = input.presetId ? findDrinkPreset(input.presetId) : undefined;
    if (input.presetId && !p) {
      return NextResponse.json({ error: "Bilinmeyen hazır içecek." }, { status: 400 });
    }
    const kind = input.kind ?? p!.kind;
    const ml = input.ml ?? p!.ml;
    const name = input.name ?? p?.name ?? "İçecek";
    // F79: şeker 4 kcal/g; kalorisi içeceğin besin günlüğü kaydına eklenir.
    const sugarCubes = input.sugarCubes ?? 0;
    const sugarG = sugarCubes * SUGAR_CUBE_G;
    const kcal = (input.kcal ?? p?.kcal ?? 0) + sugarG * 4;
    const foodName =
      sugarCubes > 0 ? `${name} (${formatNumberTr(sugarCubes)} küp şeker)` : `${name} (${formatNumberTr(ml)} ml)`;
    const date = input.date ?? getLocalDateString();
    const time = input.time ?? getLocalTimeString();

    const drink = await prisma.$transaction(async (tx) => {
      const food =
        kcal > 0
          ? await tx.foodLog.create({
              data: {
                date,
                time,
                mealType: "extra",
                name: foodName,
                grams: ml,
                caloriesSnapshot: kcal,
                proteinSnapshot: input.proteinG ?? p?.proteinG ?? 0,
                carbsSnapshot: (input.carbsG ?? p?.carbsG ?? 0) + sugarG,
                fatSnapshot: 0,
              },
            })
          : null;
      return tx.drinkLog.create({
        data: {
          date,
          time,
          kind,
          name,
          ml,
          caffeineMg: input.caffeineMg ?? p?.caffeineMg ?? 0,
          alcoholG: input.alcoholG ?? p?.alcoholG ?? 0,
          kcal,
          foodLogId: food?.id ?? null,
        },
      });
    });
    return NextResponse.json(drink, { status: 201 });
  } catch (error) {
    return apiError(error, "İçecek kaydedilemedi", "Drinks POST");
  }
}

/** F13: İçeceği ve varsa bağlı kalori kaydını siler. */
export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    const drink = await prisma.drinkLog.findUnique({ where: { id } });
    if (!drink) return NextResponse.json({ error: "İçecek kaydı bulunamadı." }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      await tx.drinkLog.delete({ where: { id } });
      if (drink.foodLogId) await tx.foodLog.deleteMany({ where: { id: drink.foodLogId } });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "İçecek silinemedi", "Drinks DELETE");
  }
}
