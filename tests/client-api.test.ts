import { afterEach, describe, expect, it } from "vitest";
import { ApiError, apiFetch } from "@/lib/client/api";
import { jsonResponse, stubFetch } from "./helpers/fetch";

let restore: (() => void) | undefined;
afterEach(() => restore?.());

describe("apiFetch", () => {
  it("JSON gövdeyi gönderir ve yanıtı ayrıştırır", async () => {
    const s = stubFetch([["/api/x", (_u, init) => jsonResponse({ echo: JSON.parse(String(init?.body)) })]]);
    restore = s.restore;
    const data = await apiFetch<{ echo: unknown }>("/api/x", { method: "POST", json: { a: 1 } });
    expect(data.echo).toEqual({ a: 1 });
    expect(new Headers(s.calls[0].init?.headers).get("content-type")).toBe("application/json");
  });

  it("başarısız yanıtta sunucunun hata mesajıyla ApiError fırlatır", async () => {
    restore = stubFetch([["/api/x", () => jsonResponse({ error: "Kayıt bulunamadı." }, 404)]]).restore;
    await expect(apiFetch("/api/x")).rejects.toMatchObject({ name: "ApiError", status: 404, message: "Kayıt bulunamadı." });
  });

  it("ağ hatasında anlaşılır mesaj verir", async () => {
    restore = stubFetch([["/api/x", () => { throw new TypeError("fetch failed"); }]]).restore;
    const err: any = await apiFetch("/api/x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
  });
});
