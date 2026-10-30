import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { compareTr } from "@/lib/text";
import { rankFoods, type FoodUsage } from "@/lib/food-search";
import { addDaysToDateString, getLocalDateString } from "@/lib/date-utils";
import { FoodItemInputSchema } from "@/lib/schemas/food";

async function loadFoodUsage(since: string): Promise<Map<string, FoodUsage>> {
  const rows = await prisma.foodLog.groupBy({
    by: ["foodItemId"],
    where: { foodItemId: { not: null }, date: { gte: since } },
    _count: { _all: true },
    _max: { date: true },
  });
  return new Map(rows.map((r) => [r.foodItemId!, { count: r._count._all, lastDate: r._max.date }]));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const limitParam = searchParams.get("limit");
    const take = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 50), 200) : 100;

    const sort = searchParams.get("sort");
    // Arama ve sıralama bellekte yapılır (katalog küçük: birkaç yüz kayıt). SQLite LIKE Türkçe
    // harfleri bilmez, ORDER BY da ikili sıralar (Ç, Ş, İ Z'den sonra gelir).
    const all = await prisma.foodItem.findMany({ where: category ? { category } : undefined });
    let ranked;
    if (search || sort === "usage") {
      // F02: son 90 günün kullanım sıklığı ve yakınlığı.
      const today = getLocalDateString();
      ranked = rankFoods(all, search, await loadFoodUsage(addDaysToDateString(today, -90)), today);
    } else {
      ranked = all.sort((a, b) => compareTr(a.name, b.name));
    }
    const foods = ranked.slice(0, take);

    return NextResponse.json(foods);
  } catch (error) {
    return apiError(error, "Besinler getirilemedi", "Foods GET");
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = FoodItemInputSchema.parse(body);

    const created = await prisma.foodItem.create({
      data: validated,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error, "Besin kaydedilemedi", "Foods POST");
  }
}
