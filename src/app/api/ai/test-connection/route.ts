import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const TestConnectionSchema = z.object({
  providerType: z.enum(["ollama", "lmstudio", "openai"]),
  baseUrl: z.string().url(),
  modelName: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { providerType, baseUrl, modelName } =
      TestConnectionSchema.parse(body);

    // /v1/models uç noktasına GET isteği atılır
    const modelsUrl = baseUrl.endsWith("/")
      ? `${baseUrl}models`
      : `${baseUrl}/models`;

    let models: string[] = [];
    let isConnected = false;
    let message = "";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 saniye zaman aşımı

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (providerType === "openai" && process.env.OPENAI_API_KEY) {
        headers["Authorization"] = `Bearer ${process.env.OPENAI_API_KEY}`;
      }

      const res = await fetch(modelsUrl, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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
      if (fetchErr.name === "AbortError") {
        message = `Bağlantı zaman aşımına uğradı (${baseUrl}). Yerel sunucunuzun (Ollama/LM Studio) açık olduğundan emin olun.`;
      } else {
        message = `Bağlantı kurulamadı: ${fetchErr.message}. Lütfen ${baseUrl} adresinde yerel sunucunun çalıştığını doğrulayın.`;
      }
    }

    // Ayarları güncelle
    await prisma.aISettings.upsert({
      where: { id: "default-ai" },
      update: {
        providerType,
        baseUrl,
        modelName: modelName || "llama3.2",
        connectionStatus: isConnected ? "connected" : "failed",
        lastTestedAt: new Date(),
      },
      create: {
        id: "default-ai",
        providerType,
        baseUrl,
        modelName: modelName || "llama3.2",
        connectionStatus: isConnected ? "connected" : "failed",
        lastTestedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: isConnected,
      message,
      models,
    });
  } catch (error: any) {
    console.error("AI connection test error:", error);
    return NextResponse.json(
      { error: error.message || "Test başarısız" },
      { status: 400 }
    );
  }
}
