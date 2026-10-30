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
    expect(r).toEqual({ applicable: true, exposed: true, port: 11434, lanAddresses: ["192.168.1.20"], exposedAt: "192.168.1.20:11434" });
    expect(fetchImpl).toHaveBeenCalledWith("http://192.168.1.20:11434/", expect.anything());
  });

  it("bağlantı reddedilirse 'kapalı' der; yalnız IPv4 ve dış arayüzler denenir", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("ECONNREFUSED");
    });
    const r = await checkLocalAIExposure({ baseUrl: "http://localhost:1234/v1", interfaces, fetchImpl });
    expect(r).toMatchObject({ applicable: true, exposed: false, port: 1234 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("bulut adresinde ya da ağ arayüzü yokken kontrol uygulanmaz / açık sayılmaz", async () => {
    const fetchImpl = vi.fn();
    expect((await checkLocalAIExposure({ baseUrl: "https://api.openai.com/v1", interfaces, fetchImpl })).applicable).toBe(false);
    const none = await checkLocalAIExposure({ baseUrl: "http://127.0.0.1:11434/v1", interfaces: { lo0: interfaces.lo0 }, fetchImpl });
    expect(none).toMatchObject({ applicable: true, exposed: false, lanAddresses: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
