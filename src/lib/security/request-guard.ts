/**
 * Yerel sunucuya gelen istekleri süzen saf karar fonksiyonu (src/proxy.ts kullanır).
 *
 * Korumalar:
 * 1. Host başlığı yalnız loopback olabilir → DNS rebinding ile başka bir sitenin
 *    127.0.0.1'e bağlanıp yanıtları okuması engellenir.
 * 2. /api/* için tarayıcıdan gelen çapraz kaynaklı (cross-site / same-site) istekler reddedilir
 *    → başka bir web sayfası veya aynı makinedeki başka bir localhost uygulaması veri yazamaz/okuyamaz.
 * 3. Masaüstünde (RUTINFIT_LAUNCH_TOKEN tanımlı) API, Tauri kabuğunun verdiği tek kullanımlık
 *    açılış anahtarıyla kurulan HttpOnly oturum çerezini ister.
 */

export const SESSION_COOKIE = "rutinfit_session";
export const LAUNCH_PARAM = "launch";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const PUBLIC_API_PATHS = new Set(["/api/health"]);

export type GuardDecision =
  | { kind: "allow" }
  | { kind: "deny"; status: number; reason: string }
  | { kind: "bootstrap"; redirectTo: string; token: string };

export interface GuardInput {
  method: string;
  url: URL;
  headers: Headers;
  cookieToken?: string;
  launchToken?: string;
}

/** "127.0.0.1:3005" → "127.0.0.1", "[::1]:3005" → "[::1]" */
export function hostnameFromHostHeader(host: string | null): string | null {
  if (!host) return null;
  const value = host.trim().toLowerCase();
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    return end > 0 ? value.slice(0, end + 1) : null;
  }
  return value.split(":")[0] || null;
}

/** Uzunluğa bağlı erken çıkış yapmayan karşılaştırma (çalışma zamanından bağımsız). */
export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function deny(status: number, reason: string): GuardDecision {
  return { kind: "deny", status, reason };
}

export function evaluateRequest(input: GuardInput): GuardDecision {
  const { url, headers, cookieToken, launchToken } = input;

  const hostname = hostnameFromHostHeader(headers.get("host"));
  if (!hostname || !LOOPBACK_HOSTS.has(hostname)) {
    return deny(403, "RutinFit yalnız bu bilgisayardan (127.0.0.1) erişilebilir.");
  }

  // Masaüstü: kabuğun açtığı ilk adres ?launch=<anahtar> taşır; çerez kurulup temiz adrese yönlendirilir.
  if (launchToken) {
    const offered = url.searchParams.get(LAUNCH_PARAM);
    if (offered !== null) {
      if (!constantTimeEqual(offered, launchToken)) {
        return deny(403, "Geçersiz açılış anahtarı.");
      }
      const clean = new URL(url.href);
      clean.searchParams.delete(LAUNCH_PARAM);
      return { kind: "bootstrap", redirectTo: clean.pathname + clean.search, token: launchToken };
    }
  }

  if (!url.pathname.startsWith("/api/") || PUBLIC_API_PATHS.has(url.pathname)) {
    return { kind: "allow" };
  }

  // Tarayıcılar her istekte Sec-Fetch-Site gönderir: yalnız aynı köken veya doğrudan gezinme kabul.
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return deny(403, "Çapraz kaynaklı istek engellendi.");
  }

  // Sec-Fetch-Site göndermeyen eski tarayıcılar için Origin yedek kontrolü.
  const origin = headers.get("origin");
  if (origin !== null) {
    let originHost: string | null = null;
    try {
      originHost = origin === "null" ? null : new URL(origin).host.toLowerCase();
    } catch {
      originHost = null;
    }
    if (originHost !== (headers.get("host") ?? "").toLowerCase()) {
      return deny(403, "Çapraz kaynaklı istek engellendi.");
    }
  }

  if (launchToken && !constantTimeEqual(cookieToken ?? "", launchToken)) {
    return deny(401, "Oturum doğrulanamadı. Uygulamayı yeniden başlatın.");
  }

  return { kind: "allow" };
}
