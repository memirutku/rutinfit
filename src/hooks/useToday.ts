"use client";

import { useEffect, useState } from "react";
import { getLocalDateString } from "@/lib/date-utils";

/**
 * Bugünün tarihi (YYYY-MM-DD). Gece yarısını geçen açık pencerede de güncellenir:
 * dakikada bir ve pencere tekrar görünür olduğunda kontrol edilir.
 */
export function useToday(pollMs = 60_000): string {
  const [today, setToday] = useState(() => getLocalDateString());

  useEffect(() => {
    const check = () => {
      const now = getLocalDateString();
      setToday((prev) => (prev === now ? prev : now));
    };
    check();
    const id = setInterval(check, pollMs);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [pollMs]);

  return today;
}
