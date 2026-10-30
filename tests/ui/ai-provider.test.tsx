import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AIProviderSection } from "@/components/settings/AIProviderSection";
import { jsonResponse, stubFetch } from "../helpers/fetch";
import { renderWithQuery } from "../helpers/query";

const SETTINGS = { providerType: "ollama", baseUrl: "http://127.0.0.1:11434/v1", modelName: "llama3.2", coachEnabled: true, tone: "supportive", endpointKind: "local" };
const STATUS = { status: "ready", providerType: "ollama", baseUrl: SETTINGS.baseUrl, modelName: "llama3.2", models: ["llama3.2:latest"], message: "Model hazır: llama3.2" };

let restore: (() => void) | undefined;
afterEach(() => restore?.());

function setup(status: Record<string, unknown>, extra: Parameters<typeof stubFetch>[0] = []) {
  const s = stubFetch([
    ...extra,
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

describe("B30: kaydedildiği belli; algılanan modeller seçilebilir", () => {
  it("başarılı test 'kaydedildi' der; algılanan model seçilince o modelle test edilip kaydedilir", async () => {
    const posts: Array<Record<string, unknown>> = [];
    const { calls } = setup(STATUS, [
      [
        "/api/ai/test-connection",
        (_u, init) => {
          const input = JSON.parse(String(init?.body));
          posts.push(input);
          return jsonResponse({
            success: true,
            saved: true,
            modelName: input.modelName,
            message: `Bağlantı başarılı ve kaydedildi. Kullanılan model: ${input.modelName}.`,
            models: ["llama3.2:latest", "qwen2.5"],
          });
        },
      ],
    ]);
    await waitFor(() => expect(screen.getByLabelText<HTMLInputElement>("Model Adı").value).toBe("llama3.2"));
    fireEvent.click(screen.getByRole("button", { name: "Bağlantıyı Test Et" }));
    expect(await screen.findByText("Bağlantı başarılı ve kaydedildi. Kullanılan model: llama3.2.")).toBeTruthy();

    const qwen = screen.getByRole("button", { name: "qwen2.5" });
    expect(qwen.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(qwen);
    expect(await screen.findByText("Bağlantı başarılı ve kaydedildi. Kullanılan model: qwen2.5.")).toBeTruthy();
    expect(posts[1]).toMatchObject({ modelName: "qwen2.5", baseUrl: SETTINGS.baseUrl });
    expect(screen.getByLabelText<HTMLInputElement>("Model Adı").value).toBe("qwen2.5");
    expect(screen.getByRole("button", { name: "qwen2.5" }).getAttribute("aria-pressed")).toBe("true");
    // Kayıttan sonra bağlantı durumu yeniden denetlenir.
    await waitFor(() => expect(calls.filter((c) => c.url.includes("/api/ai/status")).length).toBeGreaterThanOrEqual(2));
  });
});
