import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { ReminderFiredSchema } from "@/lib/schemas/reminder";
import { markRemindersFired } from "@/lib/services/reminders";

/** F83: gösterilen hatırlatmalar bugün için işaretlenir; aynı gün tekrar gelmez. */
export async function POST(req: Request) {
  try {
    const input = ReminderFiredSchema.parse(await req.json());
    await markRemindersFired(input.ids, input.date);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Hatırlatma işaretlenemedi", "Reminders fired POST");
  }
}
