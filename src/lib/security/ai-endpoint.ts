/**
 * Yapay zekâ sağlayıcı adresinin güvenli olup olmadığını denetler.
 * Sistem promptu boy, kilo, günlük öğünler ve yüklenen dosya içeriklerini taşır;
 * bu yüzden yalnız bu bilgisayardaki sunuculara (Ollama / LM Studio) veya
 * resmi OpenAI API'sine gönderilebilir.
 */

export const OPENAI_API_HOST = "api.openai.com";
const LOOPBACK_HOSTNAMES = new Set(["localhost", "[::1]"]);

export type AIEndpointCheck = { ok: true; url: URL } | { ok: false; reason: string };

function isLoopbackHostname(hostname: string): boolean {
  if (LOOPBACK_HOSTNAMES.has(hostname)) return true;
  // 127.0.0.0/8
  return /^127(\.\d{1,3}){3}$/.test(hostname);
}

export function checkAIBaseUrl(raw: string): AIEndpointCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Geçersiz adres." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Yalnız http/https adresleri desteklenir." };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "Adreste kullanıcı adı/parola bulunamaz." };
  }
  if (isLoopbackHostname(url.hostname.toLowerCase())) {
    return { ok: true, url };
  }
  if (url.hostname.toLowerCase() === OPENAI_API_HOST && url.protocol === "https:") {
    return { ok: true, url };
  }
  return {
    ok: false,
    reason:
      "Gizlilik için yalnız bu bilgisayardaki yapay zekâ sunucuları (127.0.0.1 / localhost) veya https://api.openai.com kullanılabilir.",
  };
}

/** OpenAI anahtarı yalnız resmi OpenAI adresine ve OpenAI sağlayıcısı seçiliyken gönderilir. */
export function shouldSendOpenAIKey(providerType: string, baseUrl: string): boolean {
  const check = checkAIBaseUrl(baseUrl);
  return providerType === "openai" && check.ok && check.url.hostname === OPENAI_API_HOST;
}

export const DEFAULT_AI_BASE_URL = "http://127.0.0.1:11434/v1";
