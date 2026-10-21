"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

/*
 * localStorage, React'e useSyncExternalStore ile dış kaynak olarak bağlanır. Aynı sekmedeki
 * yazımlar `listeners` ile duyurulur. localStorage'a yazılamayan değerler (kota, gizli pencere)
 * `unsaved` içinde bellekte kalır. `decoded`, ham metin değişmedikçe aynı nesneyi döndürür
 * (useSyncExternalStore her okumada aynı değeri bekler; yazılan nesnenin kimliği de korunur).
 */
const listeners = new Set<() => void>();
const unsaved = new Map<string, string>();
const decoded = new Map<string, { raw: string; ok: true; value: unknown } | { raw: string; ok: false }>();

const parseJson = (raw: string): unknown => JSON.parse(raw);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readRaw(key: string): string | null {
  const pending = unsaved.get(key);
  if (pending !== undefined) return pending;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readValue<T>(key: string, parse: (raw: string) => T, fallback: T): T {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  let entry = decoded.get(key);
  if (!entry || entry.raw !== raw) {
    try {
      entry = { raw, ok: true, value: parse(raw) };
    } catch {
      // bozuk kayıt: varsayılanla devam
      entry = { raw, ok: false };
    }
    decoded.set(key, entry);
  }
  return entry.ok ? (entry.value as T) : fallback;
}

function writeValue<T>(key: string, value: T) {
  const raw = JSON.stringify(value);
  try {
    window.localStorage.setItem(key, raw);
    unsaved.delete(key);
  } catch {
    // kota/gizli pencere: yalnız bellekte tut
    unsaved.set(key, raw);
  }
  decoded.set(key, { raw, ok: true, value });
  listeners.forEach((listener) => listener());
}

/**
 * localStorage'a bağlı durum. Okuma/yazma hataları (gizli pencere, kota, bozuk JSON)
 * uygulamayı düşürmez; değer bellekte kalır. Sunucuda ve hydration sırasında `initial`
 * kullanılır (sunucu ile istemci aynı HTML'i üretir); kayıtlı değer hydration'dan hemen sonra
 * gelir. `parse` her render'da yeni bir fonksiyon olursa setter da her render'da yenilenir;
 * modül düzeyinde bir fonksiyon verin.
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
  parse: (raw: string) => T = parseJson as (raw: string) => T
): [T, (value: T | ((prev: T) => T)) => void] {
  // İlk `initial` saklanır: her render'da yeni bir dizi/nesne verilse de kimlik sabit kalır.
  const [fallback] = useState(initial);

  const value = useSyncExternalStore(
    subscribe,
    () => readValue(key, parse, fallback),
    () => fallback
  );

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = readValue(key, parse, fallback);
      writeValue(key, typeof next === "function" ? (next as (p: T) => T)(prev) : next);
    },
    [key, parse, fallback]
  );

  return [value, update];
}
