import { NextResponse } from 'next/server';
import { PantryAdjustSchema, PantryItemInputSchema } from '@/lib/schemas/pantry';
import {
  adjustPantryAmount,
  deletePantryItem,
  getPantryInventory,
  PantryItemNotFoundError,
  upsertPantryItem,
} from '@/lib/pantry-service';

function fail(error: unknown, fallback: string) {
  if (error instanceof PantryItemNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  console.error('Pantry error:', error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export async function GET() {
  try {
    return NextResponse.json({ items: await getPantryInventory() });
  } catch (error) {
    return fail(error, 'Kiler envanteri alınamadı.');
  }
}

export async function POST(req: Request) {
  const parsed = PantryItemInputSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz kiler öğesi.' }, { status: 400 });
  }
  try {
    const item = await upsertPantryItem(parsed.data);
    return NextResponse.json({ success: true, item });
  } catch (error) {
    return fail(error, 'Kiler öğesi kaydedilemedi.');
  }
}

/** Hızlı ± düğmeleri: miktarı atomik olarak artırır/azaltır. */
export async function PATCH(req: Request) {
  const parsed = PantryAdjustSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json({ error: 'id ve sayısal delta zorunludur.' }, { status: 400 });
  }
  try {
    const item = await adjustPantryAmount(parsed.data.id, parsed.data.delta);
    return NextResponse.json({ success: true, item });
  } catch (error) {
    return fail(error, 'Miktar güncellenemedi.');
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id parametresi gereklidir.' }, { status: 400 });
  }
  try {
    await deletePantryItem(id);
    return NextResponse.json({ success: true, message: 'Öğe kilerden silindi.' });
  } catch (error) {
    return fail(error, 'Öğe silinemedi.');
  }
}
