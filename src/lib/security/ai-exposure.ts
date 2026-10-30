/**
 * F67: Yerel model sunucusu (Ollama / LM Studio) yalnız bu bilgisayarı mı dinliyor?
 * Sunucu 0.0.0.0'a bağlıysa aynı ağdaki biri modeli kullanabilir. Bilgisayarın yerel ağ
 * adresinden aynı porta istek atılır; yanıt gelirse sunucu ağa açıktır.
 */
import os, { type NetworkInterfaceInfo } from "node:os";
import { checkAIBaseUrl, OPENAI_API_HOST } from "./ai-endpoint";

export interface ExposureResult {
  /** Kontrol yalnız bu bilgisayardaki sunucular için anlamlıdır. */
  applicable: boolean;
  exposed: boolean;
  port: number | null;
  lanAddresses: string[];
  /** Yanıt veren adres:port (açıksa). */
  exposedAt?: string;
}

interface Options {
  baseUrl: string;
  interfaces?: NodeJS.Dict<NetworkInterfaceInfo[]>;
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  timeoutMs?: number;
}

export async function checkLocalAIExposure({
  baseUrl,
  interfaces = os.networkInterfaces(),
  fetchImpl = fetch,
  timeoutMs = 1500,
}: Options): Promise<ExposureResult> {
  const check = checkAIBaseUrl(baseUrl);
  if (!check.ok || check.url.hostname === OPENAI_API_HOST) {
    return { applicable: false, exposed: false, port: null, lanAddresses: [] };
  }
  const port = Number(check.url.port) || (check.url.protocol === "https:" ? 443 : 80);
  const lanAddresses = Object.values(interfaces)
    .flat()
    .filter((i): i is NetworkInterfaceInfo => !!i && !i.internal && i.family === "IPv4")
    .map((i) => i.address);

  for (const address of lanAddresses) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await fetchImpl(`http://${address}:${port}/`, { signal: controller.signal });
      return { applicable: true, exposed: true, port, lanAddresses, exposedAt: `${address}:${port}` };
    } catch {
      // Bağlantı reddedildi ya da zaman aşımı: bu adreste dinlemiyor.
    } finally {
      clearTimeout(timer);
    }
  }
  return { applicable: true, exposed: false, port, lanAddresses };
}
