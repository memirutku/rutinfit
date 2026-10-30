import { NextResponse } from "next/server";
import { apiError, HttpError } from "@/lib/api-error";
import { ReminderInputSchema, ReminderPatchSchema } from "@/lib/schemas/reminder";
import { createReminder, deleteReminder, listReminders, updateReminder } from "@/lib/services/reminders";

const idParam = (req: Request) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw new HttpError("id parametresi zorunludur.", 400);
  return id;
};

/** F83: hatırlatma listesi. */
export async function GET() {
  try {
    return NextResponse.json({ reminders: await listReminders() });
  } catch (error) {
    return apiError(error, "Hatırlatmalar getirilemedi", "Reminders GET");
  }
}

export async function POST(req: Request) {
  try {
    return NextResponse.json(await createReminder(ReminderInputSchema.parse(await req.json())), { status: 201 });
  } catch (error) {
    return apiError(error, "Hatırlatma eklenemedi", "Reminders POST");
  }
}

export async function PATCH(req: Request) {
  try {
    return NextResponse.json(await updateReminder(idParam(req), ReminderPatchSchema.parse(await req.json())));
  } catch (error) {
    return apiError(error, "Hatırlatma güncellenemedi", "Reminders PATCH");
  }
}

export async function DELETE(req: Request) {
  try {
    await deleteReminder(idParam(req));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Hatırlatma silinemedi", "Reminders DELETE");
  }
}
