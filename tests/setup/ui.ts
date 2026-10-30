import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom'da ResizeObserver yok; grafik kütüphanesinin (recharts) duyarlı kabı ister.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    // jsdom dışı ortam
  }
});
