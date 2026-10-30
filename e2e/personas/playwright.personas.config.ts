import { defineConfig, devices } from "@playwright/test";

/**
 * Dalga 5: hayali kullanıcı (persona) senaryoları. Normal test koşusuna girmez:
 *   pnpm exec playwright test -c e2e/personas/playwright.personas.config.ts
 * Masaüstü uygulamasının WKWebView'ine en yakın motor (WebKit) kullanılır.
 */
export default defineConfig({
  testDir: ".",
  testMatch: /.*\.persona\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  reporter: [["list"]],
  use: { locale: "tr-TR", timezoneId: "Europe/Istanbul" },
  projects: [{ name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1 } }],
  webServer: {
    command: "pnpm exec tsx e2e/personas/start-persona-servers.ts",
    url: "http://127.0.0.1:3306/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
    cwd: "../..",
  },
});
