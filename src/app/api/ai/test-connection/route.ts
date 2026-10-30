import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TestConnectionSchema } from "@/lib/schemas/system";
import { checkAIBaseUrl } from "@/lib/security/ai-endpoint";
import { modelAvailable } from "@/lib/ai-status";
import { probeAIEndpoint } from "@/lib/services/ai-status";

const NOT_SAVED = "Ayar kaydedilmedi.";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }

  const parsed = TestConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz bağlantı ayarları.", issues: parsed.error.issues }, { status: 400 });
  }
  const { providerType, baseUrl, modelName } = parsed.data;

  const endpoint = checkAIBaseUrl(baseUrl);
  if (!endpoint.ok) {
    return NextResponse.json({ success: false, saved: false, error: endpoint.reason, message: endpoint.reason }, { status: 400 });
  }

  const probe = await probeAIEndpoint(providerType, baseUrl);
  const { models } = probe;
  if (!probe.reachable || (probe.httpStatus ?? 200) >= 400) {
    const message = !probe.reachable
      ? probe.timedOut
        ? `Bağlantı zaman aşımına uğradı (${baseUrl}). Yerel sunucunun (Ollama / LM Studio) açık olduğundan emin ol. ${NOT_SAVED}`
        : `Bağlantı kurulamadı: ${baseUrl} adresinde çalışan bir yerel sunucu yok. ${NOT_SAVED}`
      : `Sunucu yanıt verdi ancak hata kodu döndürdü: ${probe.httpStatus}. ${NOT_SAVED}`;
    return NextResponse.json({ success: false, saved: false, message, models });
  }

  // Yalnız çalıştığı doğrulanan bağlantı kaydedilir. B30: kaydedildiği ve hangi modelin kullanılacağı söylenir.
  const savedModel = modelName?.trim() || models[0] || "llama3.2";
  try {
    const data = { providerType, baseUrl, modelName: savedModel, connectionStatus: "connected", lastTestedAt: new Date() };
    await prisma.aISettings.upsert({ where: { id: "default-ai" }, update: data, create: { id: "default-ai", ...data } });
  } catch (error) {
    console.error("AI settings save error:", error);
    return NextResponse.json({ error: "Ayarlar kaydedilemedi." }, { status: 500 });
  }

  const found = `${models.length} model algılandı.`;
  const message =
    models.length === 0
      ? `Bağlantı başarılı ve kaydedildi, ancak sunucuda yüklü model yok. Önce bir model indir.`
      : modelAvailable(savedModel, models)
        ? `Bağlantı başarılı ve kaydedildi. Kullanılan model: ${savedModel}. ${found}`
        : `Bağlantı başarılı ve kaydedildi, ancak "${savedModel}" modeli bu sunucuda yok. Algılanan modellerden birini seç.`;
  return NextResponse.json({ success: true, saved: true, modelName: savedModel, message, models });
}
