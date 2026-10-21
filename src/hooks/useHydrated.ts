"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Sunucuda ve hydration render'ında `false`, sonrasında `true`. Yalnız tarayıcıda bilinen
 * bir değeri (ör. localStorage) gösterirken sunucu HTML'iyle uyuşmazlığı önler. Hydration
 * olmadan mount edilen bileşende (istemci içi gezinme) ilk render'dan itibaren `true`'dur.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
