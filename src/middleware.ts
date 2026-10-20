import { NextResponse, type NextRequest } from "next/server";
import { evaluateRequest, SESSION_COOKIE } from "@/lib/security/request-guard";

export function middleware(req: NextRequest) {
  const decision = evaluateRequest({
    method: req.method,
    url: req.nextUrl,
    headers: req.headers,
    cookieToken: req.cookies.get(SESSION_COOKIE)?.value,
    launchToken: process.env.RUTINFIT_LAUNCH_TOKEN || undefined,
  });

  if (decision.kind === "deny") {
    return NextResponse.json({ error: decision.reason }, { status: decision.status });
  }

  if (decision.kind === "bootstrap") {
    // HTTP yönlendirmesi kullanılmaz: Next, Location adresindeki 127.0.0.1'i "localhost"a çevirir;
    // köken değişince çerez ve localStorage kaybolur. Göreli meta-refresh'i tarayıcı aynı kökene çözer.
    const html =
      `<!doctype html><html lang="tr"><head><meta charset="utf-8">` +
      `<meta http-equiv="refresh" content="0;url=${escapeHtml(decision.redirectTo)}">` +
      `<title>RutinFit</title></head><body></body></html>`;
    const res = new NextResponse(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
      },
    });
    res.cookies.set(SESSION_COOKIE, decision.token, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
    });
    return res;
  }

  return NextResponse.next();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export const config = {
  // Statik derleme çıktıları hariç her istek (sayfalar dahil: Host kontrolü DNS rebinding'i keser).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
  runtime: "nodejs",
};
