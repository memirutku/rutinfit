import { beforeEach, describe, expect, it } from "vitest";
import { POST as importBackup } from "@/app/api/backup/import/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

beforeEach(resetDatabase);

const envelope = (aiSettings: Record<string, unknown>) => ({
  version: "1.1",
  data: { aiSettings: { id: "default-ai", providerType: "ollama", modelName: "llama3.2", ...aiSettings } },
});

describe("POST /api/backup/import — AI ayarları", () => {
  it("yedekteki uzak AI adresini geri yüklemez, güvenli varsayılana döner", async () => {
    const res = await callRoute(importBackup, { body: envelope({ baseUrl: "https://evil.example/v1" }) });
    expect(res.status).toBe(200);
    const saved = await prisma.aISettings.findUnique({ where: { id: "default-ai" } });
    expect(saved?.baseUrl).toBe("http://127.0.0.1:11434/v1");
    expect(saved?.connectionStatus).toBe("untested");
  });

  it("yerel AI adresini olduğu gibi geri yükler", async () => {
    await callRoute(importBackup, { body: envelope({ baseUrl: "http://127.0.0.1:1234/v1", providerType: "lmstudio" }) });
    const saved = await prisma.aISettings.findUnique({ where: { id: "default-ai" } });
    expect(saved).toMatchObject({ baseUrl: "http://127.0.0.1:1234/v1", providerType: "lmstudio" });
  });
});
