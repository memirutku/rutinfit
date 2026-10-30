import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { ShoppingManualItemSchema } from "@/lib/schemas/shopping";
import { addManualShoppingItem, deleteManualShoppingItem } from "@/lib/services/shopping-list";

/** B09: haftanın listesine elle kalem ekler (tarife bağlı olmayan plan öğünleri için). */
export async function POST(req: Request) {
  try {
    const input = ShoppingManualItemSchema.parse(await req.json());
    return NextResponse.json(await addManualShoppingItem(input), { status: 201 });
  } catch (error) {
    return apiError(error, "Kalem eklenemedi", "Shopping item POST");
  }
}

/** B09: elle eklenen kalemi siler (?id=). */
export async function DELETE(req: Request) {
  try {
    await deleteManualShoppingItem(new URL(req.url).searchParams.get("id") ?? "");
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, "Kalem silinemedi", "Shopping item DELETE");
  }
}
