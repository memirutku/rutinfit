import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { includesTr } from "@/lib/text";

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
  brand: z.string().trim().max(120).optional().nullable(),
  barcode: z
    .string()
    .transform((v) => v.replace(/[^0-9]/g, ""))
    .refine((v) => v.length === 0 || (v.length >= 6 && v.length <= 14), "Barkod 6–14 haneli olmalıdır.")
    .transform((v) => v || null)
    .optional()
    .nullable(),
});

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
    const validated = FoodItemSchema.parse(body);

    const created = await prisma.foodItem.create({
      data: validated,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error, "Besin kaydedilemedi", "Foods POST");
  }
}
