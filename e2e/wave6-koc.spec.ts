import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

/** Dalga 6, alan E (AI koç). Ayar veya profil değiştiren testler sonunda geri alır. */

async function noHorizontalScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, `sayfa yatay taşıyor: ${scrollWidth} > ${innerWidth}`).toBeLessThanOrEqual(innerWidth);
}

async function ask(page: Page, text: string) {
  const input = page.getByPlaceholder(/Sorunuzu yazın/);
  await input.fill(text);
  await input.press("Enter");
}

test.describe("Dalga 6 · AI koç", () => {
  for (const [width, height] of [
    [1366, 768],
    [390, 844],
  ] as const) {
    test(`B27: koç sayfası ${width} px genişlikte yatay taşmaz`, async ({ page, mocks }) => {
      await page.setViewportSize({ width, height });
      await mocks.queueLLM("Kısa yanıt: http://127.0.0.1:11434/v1/chat/completions/uzun/bir/adres/ornegi/bolunmeden/devam/ediyor");
      await page.goto("/coach");
      await expect(page.getByRole("button", { name: /protein hedefimi tamamlamak/ })).toBeVisible();
      await noHorizontalScroll(page);
      await ask(page, "selam");
      await expect(page.getByText(/^Kısa yanıt:/)).toBeVisible();
      await noHorizontalScroll(page);
    });
  }
});
