import { beforeEach, describe, expect, it } from "vitest";
import { GET, PUT } from "@/app/api/ai/settings/route";
import { GET as exposureGet } from "@/app/api/ai/exposure/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

beforeEach(resetDatabase);

describe("/api/ai/settings", () => {
  it("F58: kayıt yoksa varsayılanları döner (koç açık, destekleyici ton, yerel uç nokta)", async () => {
    const res = await callRoute(GET);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      providerType: "ollama",
      baseUrl: "http://127.0.0.1:11434/v1",
      coachEnabled: true,
      tone: "supportive",
      endpointKind: "local",
    });
  });

  it("F67: OpenAI adresi 'cloud' olarak işaretlenir", async () => {
    await prisma.aISettings.create({ data: { id: "default-ai", providerType: "openai", baseUrl: "https://api.openai.com/v1", modelName: "gpt-4o-mini" } });
    expect((await callRoute(GET)).json.endpointKind).toBe("cloud");
  });

  it("F58: koç açık/kapalı ve ton kaydedilir", async () => {
    const res = await callRoute(PUT, { method: "PUT", body: { coachEnabled: false, tone: "direct" } });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ coachEnabled: false, tone: "direct" });
    expect(await prisma.aISettings.findUniqueOrThrow({ where: { id: "default-ai" } })).toMatchObject({ coachEnabled: false, tone: "direct" });
  });

  it("adres ve sağlayıcı bu uçtan değiştirilemez (yalnız bağlantı testiyle); geçersiz ton 400", async () => {
    expect((await callRoute(PUT, { method: "PUT", body: { baseUrl: "http://evil.example/v1" } })).status).toBe(400);
    expect((await callRoute(PUT, { method: "PUT", body: { tone: "kaba" } })).status).toBe(400);
    expect(await prisma.aISettings.count()).toBe(0);
  });
});

describe("/api/ai/exposure", () => {
  it("F67: bulut uç noktasında ağ kontrolü yapılmaz", async () => {
    await prisma.aISettings.create({ data: { id: "default-ai", providerType: "openai", baseUrl: "https://api.openai.com/v1", modelName: "gpt-4o-mini" } });
    const res = await callRoute(exposureGet);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ applicable: false, exposed: false });
  });
});
