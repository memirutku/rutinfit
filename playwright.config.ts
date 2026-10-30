import { defineConfig, devices } from "@playwright/test";

const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3105);
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT ?? 3106);

/**
 * Uçtan uca testler üretim derlemesine (`next build`) karşı çalışır.
 * Tüm testler aynı geçici veritabanını paylaşır; bu yüzden sırayla koşar ve
 * birbirinden bağımsız (benzersiz adlı) veri kullanır.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    locale: "tr-TR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // Tam Chromium'un yeni headless modu (headless-shell indirmeye gerek yok)
    { name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chromium" } },
    // macOS masaüstü uygulamasının WKWebView'ine en yakın motor
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "pnpm exec tsx e2e/support/start-e2e-server.ts",
    url: `http://127.0.0.1:${APP_PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { E2E_APP_PORT: String(APP_PORT), E2E_MOCK_PORT: String(MOCK_PORT) },
  },
  metadata: { mockPort: MOCK_PORT },
});
