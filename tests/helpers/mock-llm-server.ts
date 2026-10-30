import http from "node:http";
import type { AddressInfo } from "node:net";

export interface RecordedLLMRequest {
  path: string;
  body: any;
  headers: http.IncomingHttpHeaders;
}

export interface MockLLMServer {
  /** OpenAI uyumlu kök adres, ör. http://127.0.0.1:54321/v1 */
  baseUrl: string;
  requests: RecordedLLMRequest[];
  /** Sıradaki /chat/completions yanıtlarının içeriği (FIFO). Boşsa varsayılan yanıt döner. */
  queueReply: (content: string) => void;
  /** Sıradaki isteğe HTTP hata kodu döndür. */
  queueError: (status: number) => void;
  close: () => Promise<void>;
}

/**
 * Ollama / LM Studio yerine geçen, OpenAI uyumlu küçük bir sahte LLM sunucusu.
 * Vitest entegrasyon testleri ve Playwright E2E testleri ortak kullanır.
 */
export async function startMockLLMServer(models = ["mock-llama"]): Promise<MockLLMServer> {
  const requests: RecordedLLMRequest[] = [];
  const queue: Array<{ content?: string; status?: number }> = [];

  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      let body: any = undefined;
      try {
        body = raw ? JSON.parse(raw) : undefined;
      } catch {
        body = raw;
      }
      const path = (req.url ?? "").split("?")[0];
      requests.push({ path, body, headers: req.headers });

      const send = (status: number, data: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(data));
      };

      if (req.method === "GET" && path.endsWith("/models")) {
        return send(200, { object: "list", data: models.map((id) => ({ id, object: "model" })) });
      }

      if (req.method === "POST" && path.endsWith("/chat/completions")) {
        const next = queue.shift();
        if (next?.status) return send(next.status, { error: { message: "mock error" } });
        return send(200, {
          id: "chatcmpl-mock",
          object: "chat.completion",
          model: body?.model ?? models[0],
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: { role: "assistant", content: next?.content ?? "Sahte koç yanıtı." },
            },
          ],
        });
      }

      send(404, { error: "not found" });
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    requests,
    queueReply: (content) => queue.push({ content }),
    queueError: (status) => queue.push({ status }),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Modelin cevabına gömülü ```json ...``` öneri bloğu üretir. */
export function withActionBlock(text: string, action: unknown): string {
  return `${text}\n\n\`\`\`json\n${JSON.stringify(action, null, 2)}\n\`\`\``;
}
