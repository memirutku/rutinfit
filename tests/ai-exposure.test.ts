import type { NetworkInterfaceInfo } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { checkLocalAIExposure } from "@/lib/security/ai-exposure";

const iface = (address: string, internal = false, family: "IPv4" | "IPv6" = "IPv4") =>
  ({ address, internal, family, netmask: "", mac: "", cidr: null }) as unknown as NetworkInterfaceInfo;

const interfaces = { lo0: [iface("127.0.0.1", true)], en0: [iface("192.168.1.20"), iface("fe80::1", false, "IPv6")] };

describe("F67: yerel model sunucusu ağa açık mı?", () => {
  it("yerel ağ adresinden yanıt gelirse 'açık' der ve adresi bildirir", async () => {
    const fetchImpl = vi.fn(async () => new Response("Ollama is running"));
    const r = await checkLocalAIExposure({ baseUrl: "http://127.0.0.1:11434/v1", interfaces, fetchImpl });
    expect(r).toEqual({ applicable: true, localReachable: true, exposed: true, port: 11434, lanAddresses: ["192.168.1.20"], exposedAt: "192.168.1.20:11434" });
    expect(fetchImpl).toHaveBeenNthCalledWith(1, "http://127.0.0.1:11434/", expect.anything());
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "http://192.168.1.20:11434/", expect.anything());
  });

  it("bağlantı reddedilirse 'kapalı' der; yalnız dış arayüzler denenir, bağlantı-yerel IPv6 denenmez", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.startsWith("http://localhost")) return new Response("ok");
      throw new TypeError("ECONNREFUSED");
    });
    const r = await checkLocalAIExposure({ baseUrl: "http://localhost:1234/v1", interfaces, fetchImpl });
    expect(r).toMatchObject({ applicable: true, localReachable: true, exposed: false, port: 1234 });
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual(["http://localhost:1234/", "http://192.168.1.20:1234/"]);
  });

  it("B39: yerel sunucu yanıt vermiyorsa ağ kontrolü yapılmaz ve 'kapalı' sayılmaz", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("ECONNREFUSED");
    });
    const r = await checkLocalAIExposure({ baseUrl: "http://127.0.0.1:11434/v1", interfaces, fetchImpl });
    expect(r).toEqual({ applicable: true, localReachable: false, exposed: false, port: 11434, lanAddresses: ["192.168.1.20"] });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("B39: genel IPv6 adresi de köşeli parantezle denenir", async () => {
    const v6 = { en0: [iface("2a02:aa1::5", false, "IPv6"), iface("fe80::1", false, "IPv6")] };
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("[2a02:aa1::5]")) return new Response("ok");
      if (url.startsWith("http://127.0.0.1")) return new Response("ok");
      throw new TypeError("ECONNREFUSED");
    });
    const r = await checkLocalAIExposure({ baseUrl: "http://127.0.0.1:11434/v1", interfaces: v6, fetchImpl });
    expect(r).toMatchObject({ exposed: true, exposedAt: "[2a02:aa1::5]:11434", lanAddresses: ["2a02:aa1::5"] });
  });

  it("bulut adresinde ya da ağ arayüzü yokken kontrol uygulanmaz / açık sayılmaz", async () => {
    const fetchImpl = vi.fn(async () => new Response("ok"));
    expect((await checkLocalAIExposure({ baseUrl: "https://api.openai.com/v1", interfaces, fetchImpl })).applicable).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    const none = await checkLocalAIExposure({ baseUrl: "http://127.0.0.1:11434/v1", interfaces: { lo0: interfaces.lo0 }, fetchImpl });
    expect(none).toMatchObject({ applicable: true, localReachable: true, exposed: false, lanAddresses: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
