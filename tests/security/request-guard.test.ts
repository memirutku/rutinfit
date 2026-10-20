import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { evaluateRequest, hostnameFromHostHeader, SESSION_COOKIE } from "@/lib/security/request-guard";
import { middleware } from "@/middleware";

const req = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) => ({
  method: init.method ?? "GET",
  url: new URL(path, "http://127.0.0.1:3005"),
  headers: new Headers({ host: "127.0.0.1:3005", ...(init.headers ?? {}) }),
});

afterEach(() => vi.unstubAllEnvs());

describe("hostnameFromHostHeader", () => {
  it("port ve IPv6 köşeli parantezini doğru ayırır", () => {
    expect(hostnameFromHostHeader("127.0.0.1:3005")).toBe("127.0.0.1");
    expect(hostnameFromHostHeader("LOCALHOST")).toBe("localhost");
    expect(hostnameFromHostHeader("[::1]:3005")).toBe("[::1]");
    expect(hostnameFromHostHeader(null)).toBeNull();
  });
});

describe("evaluateRequest — Host (DNS rebinding)", () => {
  it("loopback dışı Host başlığını reddeder", () => {
    const d = evaluateRequest({ ...req("/api/profile"), headers: new Headers({ host: "evil.example:3005" }) });
    expect(d).toMatchObject({ kind: "deny", status: 403 });
  });

  it("LAN IP üzerinden gelen isteği reddeder", () => {
    const d = evaluateRequest({ ...req("/api/backup/export"), headers: new Headers({ host: "192.168.1.57:3005" }) });
    expect(d.kind).toBe("deny");
  });

  it("localhost ve [::1] kabul edilir", () => {
    for (const host of ["localhost:3005", "[::1]:3005"]) {
      expect(evaluateRequest({ ...req("/api/profile"), headers: new Headers({ host }) }).kind).toBe("allow");
    }
  });
});

describe("evaluateRequest — çapraz kaynak", () => {
  it.each(["cross-site", "same-site"])("Sec-Fetch-Site=%s olan API isteğini reddeder", (site) => {
    const d = evaluateRequest(req("/api/backup/import", { method: "POST", headers: { "sec-fetch-site": site } }));
    expect(d).toMatchObject({ kind: "deny", status: 403 });
  });

  it("çapraz kaynaktan GET ile yedek indirmeyi de reddeder", () => {
    const d = evaluateRequest(req("/api/backup/export", { headers: { "sec-fetch-site": "cross-site" } }));
    expect(d.kind).toBe("deny");
  });

  it("yabancı Origin başlığını (Sec-Fetch-Site yoksa) reddeder", () => {
    const d = evaluateRequest(req("/api/progress", { method: "POST", headers: { origin: "https://evil.example" } }));
    expect(d.kind).toBe("deny");
  });

  it("aynı kökenden gelen isteğe izin verir", () => {
    const d = evaluateRequest(
      req("/api/progress", { method: "POST", headers: { "sec-fetch-site": "same-origin", origin: "http://127.0.0.1:3005" } })
    );
    expect(d.kind).toBe("allow");
  });

  it("sayfa gezinmesinde Sec-Fetch-Site kontrolü yapılmaz (dış bağlantıdan uygulamayı açmak serbest)", () => {
    expect(evaluateRequest(req("/", { headers: { "sec-fetch-site": "cross-site" } })).kind).toBe("allow");
  });
});

describe("evaluateRequest — masaüstü açılış anahtarı", () => {
  const launchToken = "a".repeat(48);

  it("doğru ?launch= anahtarıyla çerez kurulumuna yönlendirir ve parametreyi temizler", () => {
    const d = evaluateRequest({ ...req("/workouts?launch=" + launchToken + "&x=1"), launchToken });
    expect(d).toEqual({ kind: "bootstrap", redirectTo: "/workouts?x=1", token: launchToken });
  });

  it("yanlış anahtarı reddeder", () => {
    expect(evaluateRequest({ ...req("/?launch=yanlis"), launchToken }).kind).toBe("deny");
  });

  it("çerezsiz API isteğini 401 ile reddeder, çerezliyi kabul eder", () => {
    expect(evaluateRequest({ ...req("/api/profile"), launchToken })).toMatchObject({ kind: "deny", status: 401 });
    expect(evaluateRequest({ ...req("/api/profile"), launchToken, cookieToken: launchToken }).kind).toBe("allow");
  });

  it("/api/health anahtarsız erişilebilir (kabuk sağlık kontrolü)", () => {
    expect(evaluateRequest({ ...req("/api/health"), launchToken }).kind).toBe("allow");
  });
});

describe("middleware", () => {
  it("reddedilen istekte JSON hata döner", async () => {
    const res = middleware(
      new NextRequest("http://127.0.0.1:3005/api/backup/export", { headers: { host: "192.168.1.57:3005" } })
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("127.0.0.1");
  });

  it("izin verilen istekte zinciri devam ettirir", () => {
    const res = middleware(new NextRequest("http://127.0.0.1:3005/api/profile", { headers: { host: "127.0.0.1:3005" } }));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("açılış anahtarıyla HttpOnly + SameSite=Strict oturum çerezi kurar", async () => {
    vi.stubEnv("RUTINFIT_LAUNCH_TOKEN", "t0ken");
    const res = middleware(
      new NextRequest("http://127.0.0.1:3005/workouts?launch=t0ken&x=1", { headers: { host: "127.0.0.1:3005" } })
    );
    // HTTP yönlendirmesi yok (Next Location'daki 127.0.0.1'i localhost'a çevirir → köken değişir).
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    const html = await res.text();
    expect(html).toContain('http-equiv="refresh" content="0;url=/workouts?x=1"');
    expect(html).not.toContain("t0ken");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${SESSION_COOKIE}=t0ken`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=strict");
  });
});
