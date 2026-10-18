import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const FoodItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().default("Genel"),
  basisGrams: z.number().positive().default(100),
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  source: z.string().default("Kullanıcı"),
  confidence: z.string().default("Yüksek"),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";

    const where: any = {};
    if (search) {
      where.name = { contains: search };
    }
    if (category) {
      where.category = category;
    }

    const foods = await prisma.foodItem.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(foods);
  } catch (error) {
    console.error("Foods GET error:", error);
    return NextResponse.json(
      { error: "Besinler getirilemedi" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = FoodItemSchema.parse(body);

    const created = await prisma.foodItem.create({
      data: validated,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error("Foods POST error:", error);
    return NextResponse.json(
      { error: error.message || "Besin kaydedilemedi" },
      { status: 400 }
    );
  }
}
