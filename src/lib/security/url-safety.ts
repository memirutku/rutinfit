/**
 * F33: Kullanıcının verdiği adrese sunucudan istek atarken SSRF koruması. Yalnız http(s) ve
 * ad çözümü genel (internet) adrese giden konaklar kabul edilir; bu bilgisayar, yerel ağ ve
 * bulut meta veri adresleri (169.254.169.254) reddedilir.
 * Not: doğrulama ile istek arasında DNS değişirse (rebinding) yakalanmaz; her yönlendirme
 * yeniden denetlenir.
 */
import dns from "node:dns/promises";
import net from "node:net";
import { HttpError } from "../api-error";

const V4_PRIVATE: Array<[number, number]> = [
  [0x00000000, 8], // 0.0.0.0/8
  [0x0a000000, 8], // 10/8
  [0x64400000, 10], // 100.64/10 (CGNAT)
  [0x7f000000, 8], // 127/8
  [0xa9fe0000, 16], // 169.254/16
  [0xac100000, 12], // 172.16/12
  [0xc0000000, 24], // 192.0.0/24
  [0xc0a80000, 16], // 192.168/16
  [0xc6120000, 15], // 198.18/15
  [0xe0000000, 4], // 224/4 çok noktaya yayın
  [0xf0000000, 4], // 240/4
];

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
}

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const n = v4ToInt(ip);
    return V4_PRIVATE.some(([base, bits]) => (n >>> (32 - bits)) === (base >>> (32 - bits)));
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return isPrivateAddress(mapped[1]);
    if (v === "::" || v === "::1") return true;
    return /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || /^ff/.test(v);
  }
  return true;
}

type Lookup = (host: string) => Promise<Array<{ address: string }>>;
const defaultLookup: Lookup = (host) => dns.lookup(host, { all: true });

export async function assertPublicUrl(raw: string, lookup: Lookup = defaultLookup): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError("Geçersiz adres.", 400);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new HttpError("Yalnız http ve https adresleri desteklenir.", 400);
  if (url.username || url.password) throw new HttpError("Adreste kullanıcı adı ya da parola olamaz.", 400);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const local = "Yerel ağdaki ya da bu bilgisayardaki adresler içe aktarılamaz.";
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) throw new HttpError(local, 400);
  const addresses = net.isIP(host) ? [{ address: host }] : await lookup(host).catch(() => {
    throw new HttpError("Adres çözümlenemedi.", 400);
  });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new HttpError(local, 400);
  return url;
}
