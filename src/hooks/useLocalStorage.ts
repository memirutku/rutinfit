"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * localStorage'a bağlı durum. Okuma/yazma hataları (gizli pencere, kota, bozuk JSON)
 * uygulamayı düşürmez; değer bellekte kalır. Okuma ilk render'dan sonra yapılır
 * (sunucu ile istemci aynı HTML'i üretir, hydration uyuşmazlığı olmaz).
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
  parse: (raw: string) => T = (raw) => JSON.parse(raw) as T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(parse(raw));
    } catch {
      // bozuk veya erişilemeyen kayıt: varsayılanla devam
    }
    // parse bilerek bağımlılık değil: her render'da yeni fonksiyon olabilir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // kota/gizli pencere: yalnız bellekte tut
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, update];
}
