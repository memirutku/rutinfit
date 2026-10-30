"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";

export interface Countdown {
  secondsLeft: number;
  totalSeconds: number;
  isRunning: boolean;
  start: (seconds: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

/**
 * Duvar saatine dayalı geri sayım. Kalan süre her tikte bitiş anından hesaplanır;
 * tarayıcı arka plandaki pencerenin zamanlayıcılarını yavaşlatsa da süre kaymaz.
 * Render saf kalır: saat (`Date.now()`) yalnız olaylarda ve tikte okunup `now` durumuna yazılır.
 */
export function useCountdown(onFinish?: () => void): Countdown {
  const endAtRef = useRef<number | null>(null);
  const pausedMsRef = useRef(0);

  const [endAt, setEndAt] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [now, setNow] = useState(0);

  const apply = useCallback((nextEndAt: number | null, nextPausedMs: number, at: number) => {
    endAtRef.current = nextEndAt;
    pausedMsRef.current = nextPausedMs;
    setEndAt(nextEndAt);
    setPausedMs(nextPausedMs);
    setNow(at);
  }, []);

  // Effect her render'da yeniden kurulmaz; bitişte o anki onFinish çağrılır.
  const finish = useEffectEvent(() => onFinish?.());

  useEffect(() => {
    if (endAt === null) return;
    const tick = () => {
      const at = Date.now();
      if (at >= endAt) {
        apply(null, 0, at);
        finish();
      } else {
        setNow(at);
      }
    };
    const id = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [endAt, apply]);

  const start = useCallback(
    (seconds: number) => {
      const at = Date.now();
      setTotalSeconds(seconds);
      apply(at + seconds * 1000, 0, at);
    },
    [apply]
  );

  const pause = useCallback(() => {
    if (endAtRef.current === null) return;
    const at = Date.now();
    apply(null, Math.max(0, endAtRef.current - at), at);
  }, [apply]);

  const resume = useCallback(() => {
    if (endAtRef.current !== null || pausedMsRef.current <= 0) return;
    const at = Date.now();
    apply(at + pausedMsRef.current, 0, at);
  }, [apply]);

  const reset = useCallback(() => apply(null, 0, Date.now()), [apply]);

  const remainingMs = endAt !== null ? Math.max(0, endAt - now) : pausedMs;
  return {
    secondsLeft: Math.ceil(remainingMs / 1000),
    totalSeconds,
    isRunning: endAt !== null,
    start,
    pause,
    resume,
    reset,
  };
}
