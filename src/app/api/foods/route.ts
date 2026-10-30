import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { includesTr } from "@/lib/text";
import { FoodItemInputSchema } from "@/lib/schemas/food";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const limitParam = searchParams.get("limit");
    const take = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 50), 200) : 100;

    // SQLite LIKE yalnız ASCII'de büyük/küçük harf duyarsızdır; Türkçe arama bellekte yapılır
    // (katalog küçük: birkaç yüz kayıt).
    const all = await prisma.foodItem.findMany({
      where: category ? { category } : undefined,
      orderBy: { name: "asc" },
    });
    const foods = (search ? all.filter((f) => includesTr(f.name, search) || includesTr(f.brand, search)) : all).slice(0, take);

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
