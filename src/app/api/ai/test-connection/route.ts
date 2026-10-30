import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TestConnectionSchema } from "@/lib/schemas/system";
import { checkAIBaseUrl, shouldSendOpenAIKey } from "@/lib/security/ai-endpoint";

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
    return NextResponse.json({ success: false, error: endpoint.reason, message: endpoint.reason }, { status: 400 });
  }

  const modelsUrl = baseUrl.endsWith("/") ? `${baseUrl}models` : `${baseUrl}/models`;
  let models: string[] = [];
  let isConnected = false;
  let message = "";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (shouldSendOpenAIKey(providerType, baseUrl) && process.env.OPENAI_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.OPENAI_API_KEY}`;
    }

    let res: Response;
    try {
      res = await fetch(modelsUrl, { headers, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.ok) {
      const data = await res.json();
      isConnected = true;
      if (Array.isArray(data.data)) {
        models = data.data.map((m: any) => m.id || m.name);
      }
      message = `Bağlantı başarılı! ${models.length} model algılandı.`;
    } else {
      message = `Sunucu yanıt verdi ancak hata kodu döndü: ${res.status} ${res.statusText}`;
    }
  } catch (fetchErr: any) {
    message =
      fetchErr?.name === "AbortError"
        ? `Bağlantı zaman aşımına uğradı (${baseUrl}). Yerel sunucunuzun (Ollama/LM Studio) açık olduğundan emin olun.`
        : `Bağlantı kurulamadı. Lütfen ${baseUrl} adresinde yerel sunucunun çalıştığını doğrulayın.`;
  }

  try {
    if (isConnected) {
      // Yalnız çalıştığı doğrulanan ayar kaydedilir.
      const data = {
        providerType,
        baseUrl,
        modelName: modelName || models[0] || "llama3.2",
        connectionStatus: "connected",
        lastTestedAt: new Date(),
      };
      await prisma.aISettings.upsert({
        where: { id: "default-ai" },
        update: data,
        create: { id: "default-ai", ...data },
      });
    }
  } catch (error) {
    console.error("AI settings save error:", error);
    return NextResponse.json({ error: "Ayarlar kaydedilemedi." }, { status: 500 });
  }

  return NextResponse.json({ success: isConnected, message, models });
}
