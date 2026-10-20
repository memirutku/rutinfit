import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ai/test-connection/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { startMockLLMServer, type MockLLMServer } from "../helpers/mock-llm-server";

let llm: MockLLMServer;
beforeAll(async () => {
  llm = await startMockLLMServer(["llama3.2", "qwen2.5"]);
});
afterAll(async () => {
  await llm.close();
});
beforeEach(async () => {
  await resetDatabase();
  llm.requests.length = 0;
  vi.unstubAllEnvs();
});

describe("POST /api/ai/test-connection", () => {
  it("başarılı bağlantıda modelleri listeler ve ayarları kaydeder", async () => {
    const res = await callRoute(POST, {
      body: { providerType: "ollama", baseUrl: llm.baseUrl, modelName: "qwen2.5" },
    });
    expect(res.status).toBe(200);
    expect(res.json.success).toBe(true);
    expect(res.json.models).toEqual(["llama3.2", "qwen2.5"]);

    const saved = await prisma.aISettings.findUnique({ where: { id: "default-ai" } });
    expect(saved).toMatchObject({ baseUrl: llm.baseUrl, modelName: "qwen2.5", connectionStatus: "connected" });
  });

  it("uzak/izinsiz bir adresi 400 ile reddeder; istek atmaz, ayar yazmaz", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await callRoute(POST, {
      body: { providerType: "ollama", baseUrl: "https://evil.example/v1" },
    });
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await prisma.aISettings.count()).toBe(0);
    fetchSpy.mockRestore();
  });

  it("başarısız testte mevcut çalışan ayarların üzerine yazmaz", async () => {
    await prisma.aISettings.create({
      data: { id: "default-ai", providerType: "lmstudio", baseUrl: llm.baseUrl, modelName: "qwen2.5", connectionStatus: "connected" },
    });

    const res = await callRoute(POST, {
      body: { providerType: "ollama", baseUrl: "http://127.0.0.1:9/v1" }, // kapalı port
    });
    expect(res.json.success).toBe(false);

    const saved = await prisma.aISettings.findUnique({ where: { id: "default-ai" } });
    expect(saved).toMatchObject({ providerType: "lmstudio", baseUrl: llm.baseUrl, modelName: "qwen2.5" });
  });

  it("OpenAI anahtarını yerel sunucuya göndermez", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-gizli");
    await callRoute(POST, { body: { providerType: "openai", baseUrl: llm.baseUrl } });
    const sent = llm.requests.find((r) => r.path.endsWith("/models"));
    expect(sent?.headers.authorization).toBeUndefined();
  });
});
