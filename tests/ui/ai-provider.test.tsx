import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AIProviderSection } from "@/components/settings/AIProviderSection";
import { jsonResponse, stubFetch } from "../helpers/fetch";
import { renderWithQuery } from "../helpers/query";

const SETTINGS = { providerType: "ollama", baseUrl: "http://127.0.0.1:11434/v1", modelName: "llama3.2", coachEnabled: true, tone: "supportive", endpointKind: "local" };
const STATUS = { status: "ready", providerType: "ollama", baseUrl: SETTINGS.baseUrl, modelName: "llama3.2", models: ["llama3.2:latest"], message: "Model hazır: llama3.2" };

let restore: (() => void) | undefined;
afterEach(() => restore?.());

function setup(status: Record<string, unknown>) {
  const s = stubFetch([
    ["/api/ai/settings", () => jsonResponse(SETTINGS)],
    ["/api/ai/status", () => jsonResponse(status)],
  ]);
  restore = s.restore;
  return { ...s, ...renderWithQuery(<AIProviderSection />) };
}

describe("B28: ayarlardaki yapay zekâ rozeti gerçek bağlantı durumuna bağlı", () => {
  it("model sunucusuna ulaşılamıyorsa rozet 'Ulaşılamıyor' der; yer rozeti yeşil 'hazır' gibi görünmez", async () => {
    const { container } = setup({ ...STATUS, status: "unreachable", models: [] });
    await waitFor(() => expect(screen.getByTestId("ai-connection-badge").textContent).toBe("Ulaşılamıyor"));
    const where = await screen.findByText(/Bu bilgisayarda · 127\.0\.0\.1:11434/);
    expect(where.className).not.toMatch(/emerald/);
    expect(container.querySelector("#yapay-zeka")).not.toBeNull();
  });

  it("model hazırsa 'Bağlı · model', model eksikse 'Model bulunamadı'", async () => {
    setup(STATUS);
    await waitFor(() => expect(screen.getByTestId("ai-connection-badge").textContent).toBe("Bağlı · llama3.2"));
    restore?.();
    document.body.innerHTML = "";
    setup({ ...STATUS, status: "model_missing" });
    await waitFor(() => expect(screen.getByTestId("ai-connection-badge").textContent).toBe("Model bulunamadı"));
  });
});
