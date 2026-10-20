import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getLocalDateString, isDateString } from '@/lib/date-utils';
import { generateShoppingList, getShoppingList } from '@/lib/services/shopping-list';

const GenerateSchema = z.object({
  weekStart: z.string().refine(isDateString, 'weekStart YYYY-AA-GG olmalıdır.').optional(),
  deductPantry: z.boolean().default(true),
});

const ToggleSchema = z.object({ id: z.string().min(1), checked: z.boolean() });

/** Kaydedilmiş haftalık listeyi döner. Salt-okunurdur; liste oluşturmak için POST kullanılır. */
export async function GET(req: Request) {
  const param = new URL(req.url).searchParams.get('weekStart');
  if (param !== null && !isDateString(param)) {
    return NextResponse.json({ error: 'weekStart YYYY-AA-GG olmalıdır.' }, { status: 400 });
  }
  try {
    return NextResponse.json(await getShoppingList(param ?? getLocalDateString()));
  } catch (error) {
    console.error('Shopping GET error:', error);
    return NextResponse.json({ error: 'Alışveriş listesi getirilemedi' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const parsed = ToggleSchema.safeParse(await req.json().catch(() => undefined));
  if (!parsed.success) {
    return NextResponse.json({ error: 'id ve checked alanları zorunludur.' }, { status: 400 });
  }
  try {
    const res = await prisma.shoppingListItem.updateMany({
      where: { id: parsed.data.id },
      data: { checked: parsed.data.checked },
    });
    if (res.count === 0) {
      return NextResponse.json({ error: 'Alışveriş kalemi bulunamadı.' }, { status: 404 });
    }
    return NextResponse.json(await prisma.shoppingListItem.findUnique({ where: { id: parsed.data.id } }));
  } catch (error) {
    console.error('Shopping PUT error:', error);
    return NextResponse.json({ error: 'Güncelleme başarısız' }, { status: 500 });
  }
}

/** Haftalık listeyi plandan yeniden oluşturur (kiler stokları düşülerek). */
export async function POST(req: Request) {
  const parsed = GenerateSchema.safeParse((await req.json().catch(() => ({}))) ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz istek.' }, { status: 400 });
  }
  try {
    const result = await generateShoppingList(parsed.data.weekStart ?? getLocalDateString(), {
      deductPantry: parsed.data.deductPantry,
    });
    return NextResponse.json({
      success: true,
      ...result,
      message: `Alışveriş listesi güncellendi (${result.items.length} kalem).`,
    });
  } catch (error) {
    console.error('Shopping POST error:', error);
    return NextResponse.json({ error: 'Alışveriş listesi yenilenemedi.' }, { status: 500 });
  }
}
