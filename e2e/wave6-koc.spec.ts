import type { APIRequestContext, Page } from "@playwright/test";
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

/** Profili değiştirir, testten sonra eski hâline döndürür. */
async function withProfile(api: APIRequestContext, patch: Record<string, unknown>, run: () => Promise<void>) {
  const original = await (await api.get("/api/profile")).json();
  const res = await api.put("/api/profile", { data: { ...original, ...patch } });
  expect(res.ok()).toBe(true);
  try {
    await run();
  } finally {
    await api.put("/api/profile", { data: original });
  }
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

  test("B03: karşılama mesajı ve hazır soru hedefi profilden alır; 'sayıları gizle'ye uyar", async ({ page, api }) => {
    const targets = { calorieTarget: 1850, calorieCeiling: 1950, proteinTargetG: 140 };
    await withProfile(api, { ...targets, hideNumbers: false }, async () => {
      await page.goto("/coach");
      const welcome = page.getByText(/^Merhaba! Ben RutinFit/);
      await expect(welcome).toContainText("1.850 kcal");
      await expect(welcome).toContainText("140 g protein");
      await expect(page.getByRole("button", { name: /1\.850 kcal hedefime uyan/ })).toBeVisible();
      await expect(page.getByText(/2\.080/)).toHaveCount(0);
    });
    await withProfile(api, { ...targets, hideNumbers: true }, async () => {
      await page.goto("/coach");
      const welcome = page.getByText(/^Merhaba! Ben RutinFit/);
      await expect(welcome).toContainText("Hedeflerine");
      expect(await welcome.textContent()).not.toMatch(/\d/);
      await expect(page.getByRole("button", { name: /kalori hedefime uyan/ })).toBeVisible();
      await expect(page.getByText(/\d[\d.]*\s*kcal/)).toHaveCount(0);
    });
  });
});
