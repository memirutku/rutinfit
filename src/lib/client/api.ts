/** Sunucunun döndürdüğü hata mesajını taşıyan istemci hatası. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiFetchInit extends Omit<RequestInit, "body"> {
  /** JSON olarak gönderilecek gövde (Content-Type otomatik eklenir). */
  json?: unknown;
  body?: BodyInit | null;
}

/**
 * fetch + res.ok kontrolü + JSON ayrıştırma. Başarısız yanıtta sunucunun `error`
 * mesajıyla ApiError fırlatır; çağıran yer hatayı kullanıcıya gösterebilir.
 */
export async function apiFetch<T = unknown>(url: string, init: ApiFetchInit = {}): Promise<T> {
  const { json, headers: rawHeaders, ...rest } = init;
  const headers = new Headers(rawHeaders);
  let body = rest.body;
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }

  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers, body });
  } catch {
    throw new ApiError("Sunucuya ulaşılamadı. Uygulama hâlâ açılıyor olabilir; birkaç saniye sonra tekrar deneyin.", 0);
  }

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `İstek başarısız oldu (${res.status}).`;
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}

/** Hata nesnesinden kullanıcıya gösterilecek mesaj. */
export function errorMessage(error: unknown, fallback = "Beklenmeyen bir hata oluştu."): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
