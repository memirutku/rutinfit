import { NextResponse } from "next/server";
import { BackupEnvelopeSchema } from "@/lib/backup-schema";
import { BackupValidationError, legacyToTables, restoreTables } from "@/lib/services/backup";

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON formatı" }, { status: 400 });
  }

  const envelope = BackupEnvelopeSchema.safeParse(json);
  if (!envelope.success) {
    const issue = envelope.error.issues[0];
    return NextResponse.json(
      { error: issue?.message || "Geçersiz yedek dosyası formatı", details: envelope.error.flatten() },
      { status: 400 }
    );
  }

  const { version, data } = envelope.data;
  const tables = version.startsWith("1.") ? legacyToTables(data as Record<string, any>) : data;

  try {
    const { counts } = await restoreTables(tables);
    return NextResponse.json({ success: true, message: "Tüm veriler başarıyla geri yüklendi.", counts });
  } catch (error) {
    if (error instanceof BackupValidationError) {
      return NextResponse.json({ error: error.message, issues: error.issues.slice(0, 50) }, { status: 400 });
    }
    console.error("Backup import error:", error);
    return NextResponse.json(
      { error: "Yedek geri yüklenemedi; hiçbir veri değiştirilmedi." },
      { status: 500 }
    );
  }
}
