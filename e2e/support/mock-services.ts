import http from "node:http";
import type { AddressInfo } from "node:net";

/**
 * E2E testleri için tek süreçte iki sahte dış servis:
 *  - OpenAI uyumlu LLM:   /v1/models, /v1/chat/completions
 *  - Open Food Facts:     /off/api/v3/product/<barkod>.json, /off/cgi/search.pl
 * Testler yanıtları /__control/* uçlarıyla yönetir.
 */

export const OFF_PRODUCTS: Record<string, unknown> = {
  "8690000000017": {
    product_name_tr: "Test Granola",
    brands: "E2E Marka",
    nutriments: { "energy-kcal_100g": 420, proteins_100g: 9, carbohydrates_100g: 64, fat_100g: 14 },
  },
};

export async function startMockServices(port = 0) {
  const llmQueue: Array<{ content?: string; status?: number }> = [];
  const llmRequests: unknown[] = [];
  /** true iken /v1/* bağlantısı yanıtsız kapatılır: "yerel model yok" durumu (kapalı port gibi). */
  let llmOffline = false;

  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = new URL(req.url ?? "/", "http://mock");
      const send = (status: number, data: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(data));
      };
      const body = raw ? safeJson(raw) : undefined;

      // ---- kontrol uçları
      if (url.pathname === "/__control/llm/queue" && req.method === "POST") {
        llmQueue.push(body as { content?: string; status?: number });
        return send(200, { queued: llmQueue.length });
      }
      if (url.pathname === "/__control/reset" && req.method === "POST") {
        llmQueue.length = 0;
        llmRequests.length = 0;
        llmOffline = false;
        return send(200, { ok: true });
      }
      if (url.pathname === "/__control/llm/requests") return send(200, llmRequests);
      if (url.pathname === "/__control/llm/offline" && req.method === "POST") {
        llmOffline = Boolean((body as { offline?: boolean } | undefined)?.offline);
        return send(200, { offline: llmOffline });
      }

      // ---- sahte LLM kapalı: istemci bağlantı hatası alır (ECONNRESET), yanıt yok
      if (llmOffline && url.pathname.startsWith("/v1/")) {
        req.socket.destroy();
        return;
      }

      // ---- sahte LLM
      if (url.pathname === "/v1/models") return send(200, { object: "list", data: [{ id: "mock-llama" }] });
      if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
        llmRequests.push(body);
        const next = llmQueue.shift();
        if (next?.status) return send(next.status, { error: { message: "mock error" } });
        return send(200, {
          id: "chatcmpl-e2e",
          object: "chat.completion",
          choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: next?.content ?? "Sahte koç yanıtı." } }],
        });
      }

      // ---- sahte Open Food Facts
      const product = url.pathname.match(/^\/off\/api\/v3\/product\/(\d+)\.json$/);
      if (product) {
        const p = OFF_PRODUCTS[product[1]];
        return p ? send(200, { status: "success", code: product[1], product: p }) : send(404, { status: "failure", code: product[1] });
      }
      if (url.pathname === "/off/cgi/search.pl") return send(200, { count: 0, products: [] });

      send(404, { error: "not found" });
    });
  });

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const actualPort = (server.address() as AddressInfo).port;
  return {
    port: actualPort,
    llmBaseUrl: `http://127.0.0.1:${actualPort}/v1`,
    offBaseUrl: `http://127.0.0.1:${actualPort}/off`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

function safeJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
