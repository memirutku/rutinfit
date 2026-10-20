import { NextRequest } from "next/server";

type Handler = (req: NextRequest) => Response | Promise<Response>;

export interface CallRouteOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path?: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  formData?: FormData;
  headers?: Record<string, string>;
}

export interface RouteResult<T = any> {
  status: number;
  json: T;
  text: string;
  headers: Headers;
}

/**
 * Bir Next.js route handler'ını gerçek bir NextRequest ile doğrudan çağırır.
 * Sunucu açmadan API davranışını (durum kodu + gövde) test etmeyi sağlar.
 */
export async function callRoute<T = any>(
  handler: Handler,
  opts: CallRouteOptions = {}
): Promise<RouteResult<T>> {
  const url = new URL(opts.path ?? "/api/test", "http://127.0.0.1:3005");
  for (const [key, value] of Object.entries(opts.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
    headers["content-type"] ??= "application/json";
  }

  const method = opts.method ?? (body !== undefined ? "POST" : "GET");
  const res = await handler(new NextRequest(url, { method, headers, body }));
  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { status: res.status, json, text, headers: res.headers };
}
