import { NextResponse } from 'next/server';
import {
  getPantryInventory,
  upsertPantryItem,
  deletePantryItem,
} from '@/lib/pantry-service';

export async function GET() {
  try {
    const items = await getPantryInventory();
    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Kiler envanteri alınamadı.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const item = await upsertPantryItem(body);
    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Kiler öğesi kaydedilemedi.' },
      { status: 400 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id parametresi gereklidir.' }, { status: 400 });
    }

    await deletePantryItem(id);
    return NextResponse.json({ success: true, message: 'Öğe kilerden silindi.' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Öğe silinemedi.' },
      { status: 400 }
    );
  }
}
