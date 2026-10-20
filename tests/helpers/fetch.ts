import { vi } from "vitest";

export interface StubbedCall {
  url: string;
  init?: RequestInit;
}

type Responder = (url: string, init?: RequestInit) => Response | Promise<Response>;

/**
 * global fetch'i URL desenine göre yanıt veren bir sahteyle değiştirir.
 * Eşleşmeyen istekler hata fırlatır: test beklenmedik bir ağ çağrısı yaparsa görünür olur.
 */
export function stubFetch(routes: Array<[RegExp | string, Responder]>) {
  const calls: StubbedCall[] = [];
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    for (const [pattern, responder] of routes) {
      const hit = typeof pattern === "string" ? url.includes(pattern) : pattern.test(url);
      if (hit) return responder(url, init);
    }
    throw new TypeError(`stubFetch: beklenmeyen istek ${url}`);
  });
  vi.stubGlobal("fetch", mock);
  return { calls, mock, restore: () => vi.unstubAllGlobals() };
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
