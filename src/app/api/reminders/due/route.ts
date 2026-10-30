import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { dueReminders } from "@/lib/services/reminders";

/** F83: şu an gösterilmesi gereken hatırlatmalar (arayüz dakikada bir sorar). */
export async function GET() {
  try {
    return NextResponse.json({ due: await dueReminders() });
  } catch (error) {
    return apiError(error, "Hatırlatmalar hesaplanamadı", "Reminders due GET");
  }
}
