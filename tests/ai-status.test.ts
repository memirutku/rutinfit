import { describe, expect, it } from "vitest";
import { classifyAIProbe, modelAvailable } from "@/lib/ai-status";

describe("B28: model listede var mı", () => {
  it("tam ad, Ollama ':latest' etiketi ve büyük-küçük harf farkı eşleşir", () => {
    expect(modelAvailable("qwen2.5", ["llama3.2", "qwen2.5"])).toBe(true);
    expect(modelAvailable("llama3.2", ["llama3.2:latest"])).toBe(true);
    expect(modelAvailable("Llama3.2", ["llama3.2:latest"])).toBe(true);
  });

  it("başka etiket ya da başka model eşleşmez; boş liste eşleşmez", () => {
    expect(modelAvailable("llama3.2", ["llama3.2:3b"])).toBe(false);
    expect(modelAvailable("llama3.2", ["mistral"])).toBe(false);
    expect(modelAvailable("llama3.2", [])).toBe(false);
  });
});

describe("B28: bağlantı denetiminin sonucu", () => {
  it("ulaşılamayan, hata dönen, modelsiz ve modeli eksik sunucuyu ayırır", () => {
    expect(classifyAIProbe({ reachable: false, models: [] }, "llama3.2")).toBe("unreachable");
    expect(classifyAIProbe({ reachable: true, httpStatus: 500, models: [] }, "llama3.2")).toBe("server_error");
    expect(classifyAIProbe({ reachable: true, httpStatus: 200, models: [] }, "llama3.2")).toBe("no_models");
    expect(classifyAIProbe({ reachable: true, httpStatus: 200, models: ["mistral"] }, "llama3.2")).toBe("model_missing");
    expect(classifyAIProbe({ reachable: true, httpStatus: 200, models: ["llama3.2:latest"] }, "llama3.2")).toBe("ready");
  });
});
