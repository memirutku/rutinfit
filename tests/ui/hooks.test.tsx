import { act, render, renderHook } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCountdown } from "@/hooks/useCountdown";
import { useToday } from "@/hooks/useToday";
import { useLocalStorage } from "@/hooks/useLocalStorage";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T10:00:00"));
  vi.stubEnv("RUTINFIT_TIMEZONE", Intl.DateTimeFormat().resolvedOptions().timeZone);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("useCountdown", () => {
  it("geri sayar, duraklatınca durur, devam edince biter ve onFinish bir kez çağrılır", () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() => useCountdown(onFinish));

    act(() => result.current.start(90));
    expect(result.current).toMatchObject({ secondsLeft: 90, isRunning: true, totalSeconds: 90 });

    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.secondsLeft).toBe(60);

    act(() => result.current.pause());
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current).toMatchObject({ secondsLeft: 60, isRunning: false });

    act(() => result.current.resume());
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toMatchObject({ secondsLeft: 0, isRunning: false });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("zamanlayıcı yavaşlatılsa da (arka plan penceresi) kalan süre duvar saatinden hesaplanır", () => {
    const { result } = renderHook(() => useCountdown());
    act(() => result.current.start(120));
    // Saat 50 sn ilerler ama aradaki tikler çalışmaz (tarayıcı kısıtlaması)
    act(() => {
      vi.setSystemTime(Date.now() + 50_000);
      vi.advanceTimersByTime(250);
    });
    expect(result.current.secondsLeft).toBe(70);
  });

  it("pencere öne gelince (visibilitychange) kalan süre sonraki tiki beklemeden güncellenir", () => {
    const { result } = renderHook(() => useCountdown());
    act(() => result.current.start(120));
    act(() => {
      vi.setSystemTime(Date.now() + 50_000); // zamanlayıcılar hiç çalışmadı
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toMatchObject({ secondsLeft: 70, isRunning: true });
  });

  it("süre bitince en son verilen onFinish çağrılır (sayaç yeniden başlamaz)", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ onFinish }) => useCountdown(onFinish), {
      initialProps: { onFinish: first },
    });
    act(() => result.current.start(2));
    act(() => vi.advanceTimersByTime(1000));
    rerender({ onFinish: second });
    expect(result.current.secondsLeft).toBe(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(result.current.isRunning).toBe(false);
  });

  it("reset sayacı sıfırlar", () => {
    const { result } = renderHook(() => useCountdown());
    act(() => result.current.start(60));
    act(() => result.current.reset());
    expect(result.current).toMatchObject({ secondsLeft: 0, isRunning: false });
  });
});

describe("useToday", () => {
  it("gece yarısını geçen açık pencerede tarihi yeniler", () => {
    vi.setSystemTime(new Date("2026-10-20T23:59:30"));
    const { result } = renderHook(() => useToday());
    expect(result.current).toBe("2026-10-20");
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toBe("2026-10-21");
  });
});

describe("useLocalStorage", () => {
  it("bozuk kayıtta varsayılana döner, yazılan değeri saklar", () => {
    localStorage.setItem("k", "{bozuk");
    const { result } = renderHook(() => useLocalStorage("k", [1]));
    expect(result.current[0]).toEqual([1]);
    act(() => result.current[1]([2, 3]));
    expect(JSON.parse(localStorage.getItem("k")!)).toEqual([2, 3]);
  });

  it("localStorage erişilemezse uygulama düşmez, değer bellekte kalır", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    const { result } = renderHook(() => useLocalStorage("k2", 0));
    act(() => result.current[1](5));
    expect(result.current[0]).toBe(5);
    spy.mockRestore();
  });

  it("art arda fonksiyonel güncellemeler birikir; aynı anahtarı okuyan bileşenler eşit kalır", () => {
    const a = renderHook(() => useLocalStorage("sayi", 0));
    const b = renderHook(() => useLocalStorage("sayi", 0));
    act(() => {
      a.result.current[1]((p) => p + 1);
      a.result.current[1]((p) => p + 1);
    });
    expect(a.result.current[0]).toBe(2);
    expect(b.result.current[0]).toBe(2);
    expect(localStorage.getItem("sayi")).toBe("2");
  });

  it("değer ve setter render'lar arasında sabit kalır; yazılan nesnenin kimliği korunur", () => {
    // `[]` her render'da yeni bir dizi: ilk değer yine de sabit kalmalı (effect bağımlılıkları için).
    const { result, rerender } = renderHook(() => useLocalStorage<{ n: number }[]>("liste", []));
    const [first, setter] = result.current;
    rerender();
    expect(result.current[0]).toBe(first);
    expect(result.current[1]).toBe(setter);

    const next = [{ n: 1 }];
    act(() => setter(next));
    rerender();
    expect(result.current[0]).toBe(next);
    expect(result.current[1]).toBe(setter);
  });

  it("verilen parse ile okur", () => {
    localStorage.setItem("parse", JSON.stringify({ items: [1, 2] }));
    const parse = (raw: string) => (JSON.parse(raw) as { items: number[] }).items;
    const { result } = renderHook(() => useLocalStorage<number[]>("parse", [], parse));
    expect(result.current[0]).toEqual([1, 2]);
  });

  it("istemcide (hydration olmadan) ilk render kayıtlı değeri gösterir", () => {
    localStorage.setItem("ilk", JSON.stringify("kayıtlı"));
    const seen: string[] = [];
    function Probe() {
      const [value] = useLocalStorage("ilk", "varsayılan");
      seen.push(value);
      return null;
    }
    render(<Probe />);
    expect(seen[0]).toBe("kayıtlı");
  });

  it("sunucu HTML'i ve hydration `initial` kullanır; kayıtlı değer hydration'dan sonra gelir, uyuşmazlık olmaz", async () => {
    localStorage.setItem("ssr", JSON.stringify("kayıtlı"));
    function Stored() {
      const [value] = useLocalStorage("ssr", "varsayılan");
      return <span>{value}</span>;
    }

    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const html = renderToString(<Stored />);
    expect(html).toContain("varsayılan");
    expect(getItem).not.toHaveBeenCalled(); // sunucu render'ı localStorage'a dokunmaz
    getItem.mockRestore();

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const recoverable = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(container, <Stored />, { onRecoverableError: recoverable });
    });
    expect(container.textContent).toBe("kayıtlı");
    expect(recoverable).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
    act(() => root?.unmount());
    container.remove();
  });
});
