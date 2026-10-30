import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/ai/status/route";
import { prisma } from "@/lib/prisma";
import { AIStatusSchema } from "@/lib/schemas/chat";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { startMockLLMServer, type MockLLMServer } from "../helpers/mock-llm-server";

let llm: MockLLMServer;
let empty: MockLLMServer;
beforeAll(async () => {
  llm = await startMockLLMServer(["llama3.2:latest", "qwen2.5"]);
  empty = await startMockLLMServer([]);
});
afterAll(async () => {
  await llm.close();
  await empty.close();
});
beforeEach(resetDatabase);

const settings = (data: { baseUrl: string; modelName?: string; coachEnabled?: boolean; providerType?: string }) =>
  prisma.aISettings.create({ data: { id: "default-ai", providerType: "ollama", modelName: "llama3.2", ...data } });

async function status() {
  const res = await callRoute(GET);
  expect(res.status).toBe(200);
  return AIStatusSchema.parse(res.json);
}

describe("GET /api/ai/status (B28)", () => {
  it("sunucu çalışıyor ve seçili model yüklüyse 'ready'", async () => {
    await settings({ baseUrl: llm.baseUrl });
    expect(await status()).toMatchObject({ status: "ready", modelName: "llama3.2", models: ["llama3.2:latest", "qwen2.5"] });
  });

  it("adreste sunucu yoksa 'unreachable'; mesaj düz metindir", async () => {
    await settings({ baseUrl: "http://127.0.0.1:9/v1" });
    const s = await status();
    expect(s.status).toBe("unreachable");
    expect(s.message).toMatch(/127\.0\.0\.1:9/);
    expect(s.message).not.toMatch(/\*\*/);
  });

  it("sunucu çalışıyor ama seçili model yoksa 'model_missing' ve algılanan modeller", async () => {
    await settings({ baseUrl: llm.baseUrl, modelName: "mistral" });
    const s = await status();
    expect(s.status).toBe("model_missing");
    expect(s.models).toEqual(["llama3.2:latest", "qwen2.5"]);
    expect(s.message).toMatch(/mistral/);
  });

  it("sunucuda hiç model yoksa 'no_models'", async () => {
    await settings({ baseUrl: empty.baseUrl });
    expect((await status()).status).toBe("no_models");
  });

  it("koç kapalıysa 'disabled' ve sunucuya istek gitmez", async () => {
    await settings({ baseUrl: llm.baseUrl, coachEnabled: false });
    const before = llm.requests.length;
    expect((await status()).status).toBe("disabled");
    expect(llm.requests.length).toBe(before);
  });

  it("izinsiz adres kayıtlıysa 'invalid_url' ve oraya istek gitmez", async () => {
    await settings({ baseUrl: "https://evil.example/v1" });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect((await status()).status).toBe("invalid_url");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
