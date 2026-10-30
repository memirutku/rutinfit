/**
 * F67: Yerel model sunucusu (Ollama / LM Studio) yalnız bu bilgisayarı mı dinliyor?
 * Sunucu 0.0.0.0'a bağlıysa aynı ağdaki biri modeli kullanabilir. Bilgisayarın yerel ağ
 * adresinden aynı porta istek atılır; yanıt gelirse sunucu ağa açıktır.
 *
 * B39: Önce kayıtlı adres denenir. Sunucu orada da yanıt vermiyorsa (çalışmıyorsa) ağ kontrolü
 * anlamsızdır: sonuç "kontrol yapılmadı" olur, "yalnız bu bilgisayar" onayı verilmez. Genel
 * IPv6 adresleri de denenir (bağlantı-yerel fe80:: denenmez).
 */
import os, { type NetworkInterfaceInfo } from "node:os";
import { checkAIBaseUrl, OPENAI_API_HOST } from "./ai-endpoint";

export interface ExposureResult {
  /** Kontrol yalnız bu bilgisayardaki sunucular için anlamlıdır. */
  applicable: boolean;
  /** B39: kayıtlı adresteki sunucu yanıt verdi mi? false ise ağ kontrolü yapılmadı. */
  localReachable: boolean;
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
    return { applicable: false, localReachable: false, exposed: false, port: null, lanAddresses: [] };
  }
  const port = Number(check.url.port) || (check.url.protocol === "https:" ? 443 : 80);
  const lanAddresses = Object.values(interfaces)
    .flat()
    .filter((i): i is NetworkInterfaceInfo => !!i && !i.internal && (i.family === "IPv4" || (i.family === "IPv6" && !/^fe80:/i.test(i.address))))
    .map((i) => i.address);

  /** Yanıt gelirse (durum kodu ne olursa olsun) o adreste dinleyen bir sunucu vardır. */
  const answers = async (url: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await fetchImpl(url, { signal: controller.signal });
      return true;
    } catch {
      // Bağlantı reddedildi ya da zaman aşımı: bu adreste dinlemiyor.
      return false;
    } finally {
      clearTimeout(timer);
    }
  };

  if (!(await answers(`${check.url.protocol}//${check.url.host}/`))) {
    return { applicable: true, localReachable: false, exposed: false, port, lanAddresses };
  }
  for (const address of lanAddresses) {
    const host = address.includes(":") ? `[${address}]` : address;
    if (await answers(`http://${host}:${port}/`)) {
      return { applicable: true, localReachable: true, exposed: true, port, lanAddresses, exposedAt: `${host}:${port}` };
    }
  }
  return { applicable: true, localReachable: true, exposed: false, port, lanAddresses };
}
