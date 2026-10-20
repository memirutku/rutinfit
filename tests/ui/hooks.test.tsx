import { act, renderHook } from "@testing-library/react";
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
});
