"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
 */
export function useCountdown(onFinish?: () => void): Countdown {
  const endAtRef = useRef<number | null>(null);
  const pausedMsRef = useRef(0);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const [endAt, setEndAt] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [, setTick] = useState(0);

  const apply = useCallback((nextEndAt: number | null, nextPausedMs: number) => {
    endAtRef.current = nextEndAt;
    pausedMsRef.current = nextPausedMs;
    setEndAt(nextEndAt);
    setPausedMs(nextPausedMs);
  }, []);

  useEffect(() => {
    if (endAt === null) return;
    const tick = () => {
      if (Date.now() >= endAt) {
        apply(null, 0);
        onFinishRef.current?.();
      } else {
        setTick((t) => t + 1);
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
      setTotalSeconds(seconds);
      apply(Date.now() + seconds * 1000, 0);
    },
    [apply]
  );

  const pause = useCallback(() => {
    if (endAtRef.current === null) return;
    apply(null, Math.max(0, endAtRef.current - Date.now()));
  }, [apply]);

  const resume = useCallback(() => {
    if (endAtRef.current !== null || pausedMsRef.current <= 0) return;
    apply(Date.now() + pausedMsRef.current, 0);
  }, [apply]);

  const reset = useCallback(() => apply(null, 0), [apply]);

  const remainingMs = endAt !== null ? Math.max(0, endAt - Date.now()) : pausedMs;
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
