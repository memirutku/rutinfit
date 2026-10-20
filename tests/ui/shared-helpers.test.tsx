import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTimedMessage } from "@/hooks/useTimedMessage";
import { clientId, keyedBy } from "@/lib/client/keys";

describe("useTimedMessage", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("süre dolunca kapanır; yeni bildirim öncekinin zamanlayıcısıyla erken kapanmaz", () => {
    const { result } = renderHook(() => useTimedMessage<string>(4000));
    act(() => result.current.show("ilk"));
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.show("ikinci"));
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.message).toBe("ikinci");
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.message).toBeNull();
  });

  it("ms null ise kalıcıdır; clear kapatır", () => {
    const { result } = renderHook(() => useTimedMessage<string>(1000));
    act(() => result.current.show("kalıcı", null));
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.message).toBe("kalıcı");
    act(() => result.current.clear());
    expect(result.current.message).toBeNull();
  });

  it("bileşen kaldırılınca bekleyen zamanlayıcı temizlenir", () => {
    const { result, unmount } = renderHook(() => useTimedMessage<string>(1000));
    act(() => result.current.show("x"));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("liste anahtarları", () => {
  it("clientId her çağrıda benzersizdir", () => {
    const ids = new Set(Array.from({ length: 50 }, () => clientId("set")));
    expect(ids.size).toBe(50);
  });

  it("keyedBy içerikten anahtar üretir, tekrarlara sıra numarası ekler", () => {
    expect(keyedBy(["Yulaf", "Süt", "Yulaf"], (x) => x).map((k) => k.key)).toEqual(["Yulaf", "Süt", "Yulaf#2"]);
  });
});
