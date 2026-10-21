"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Belirli süre görünüp kendiliğinden kaybolan bildirim. Zamanlayıcı bileşende tutulur:
 * yeni bildirim öncekinin zamanlayıcısını iptal eder (erken kapanmaz) ve bileşen
 * kaldırılınca temizlenir (kaldırılmış bileşende state güncellenmez).
 */
export function useTimedMessage<T>(defaultMs: number) {
  const [message, setMessage] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    setMessage(null);
  }, []);

  /** Bildirimi gösterir; `ms` null ise kullanıcı kapatana veya yenisi gelene kadar kalır. */
  const show = useCallback(
    (value: T, ms: number | null = defaultMs) => {
      clearTimeout(timer.current);
      setMessage(value);
      if (ms !== null) timer.current = setTimeout(() => setMessage(null), ms);
    },
    [defaultMs]
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return { message, show, clear };
}
