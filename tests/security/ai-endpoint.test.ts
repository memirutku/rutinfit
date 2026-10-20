import { describe, expect, it } from "vitest";
import { checkAIBaseUrl, shouldSendOpenAIKey } from "@/lib/security/ai-endpoint";

describe("checkAIBaseUrl", () => {
  it.each([
    "http://127.0.0.1:11434/v1",
    "http://localhost:1234/v1",
    "http://[::1]:11434/v1",
    "http://127.0.0.2:8000/v1",
    "https://api.openai.com/v1",
  ])("izin verir: %s", (url) => {
    expect(checkAIBaseUrl(url).ok).toBe(true);
  });

  it.each([
    "https://evil.example/v1",
    "http://192.168.1.20:11434/v1",
    "http://api.openai.com/v1", // şifresiz
    "http://0.0.0.0:11434/v1",
    "http://user:pass@127.0.0.1:11434/v1",
    "file:///etc/passwd",
    "ftp://127.0.0.1/v1",
    "bozuk adres",
  ])("reddeder: %s", (url) => {
    expect(checkAIBaseUrl(url).ok).toBe(false);
  });
});

describe("shouldSendOpenAIKey", () => {
  it("anahtarı yalnız OpenAI sağlayıcısı + resmi adres birlikteyken gönderir", () => {
    expect(shouldSendOpenAIKey("openai", "https://api.openai.com/v1")).toBe(true);
    expect(shouldSendOpenAIKey("openai", "http://127.0.0.1:11434/v1")).toBe(false);
    expect(shouldSendOpenAIKey("ollama", "https://api.openai.com/v1")).toBe(false);
  });
});
