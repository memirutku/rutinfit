import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect, actionBlock, uniq } from "./fixtures";

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

  test("B28: model yokken sayfa açılınca 'Koç kapalı' satırı, kurulum adımları ve Ayarlar'da test et görünür", async ({ page, mocks }) => {
    await mocks.setLLMOffline(true);
    try {
      await page.goto("/coach");
      const row = page.getByRole("alert").filter({ hasText: "Koç kapalı: yerel model bulunamadı" });
      await expect(row).toBeVisible();
      await expect(row).toContainText("Ollama");
      await expect(row).toContainText("LM Studio");
      await expect(page.getByTestId("ai-status-badge")).toHaveText(/Koç kapalı/);

      // Hata balonu düz metindir (ham markdown yok).
      await ask(page, "akşam ne yiyeyim?");
      await expect(page.getByText(/modeline ulaşılamadı/)).toBeVisible();
      await expect(page.getByText(/\*\*/)).toHaveCount(0);

      await row.getByRole("link", { name: "Ayarlar'da test et" }).click();
      await expect(page).toHaveURL(/\/settings#yapay-zeka/);
      // Ayarlardaki rozet çalışmayan modeli "hazır" gibi göstermez.
      await expect(page.getByTestId("ai-connection-badge")).toHaveText(/Ulaşılamıyor/);
    } finally {
      await mocks.setLLMOffline(false);
    }
  });

  test("B28: model çalışıyorsa satır çıkmaz, rozet hazır der", async ({ page }) => {
    await page.goto("/coach");
    await expect(page.getByTestId("ai-status-badge")).toHaveText(/Model hazır · mock-llama/);
    await expect(page.getByText("Koç kapalı: yerel model bulunamadı")).toHaveCount(0);
  });

  test("B29: öneri JSON'u balonda görünmez, eksik malzemede 'Hesaplandı' yazmaz, onaydan sonra rozet 'Onaylandı'", async ({ page, mocks }) => {
    const title = uniq("E2E Fırın Somon");
    await mocks.queueLLM(
      actionBlock("Akşam için önerim:", {
        type: "meal_proposal",
        mealType: "dinner",
        title,
        rationale: "Protein ve omega-3",
        prepMinutes: 25,
        ingredients: [
          { foodName: "Zzyzx Balığı", grams: 150 },
          { foodName: "Qwfp Tahılı", grams: 60 },
        ],
        estimatedMacros: { calories: 600, proteinG: 40, carbsG: 45, fatG: 22 },
      })
    );
    await page.goto("/coach");
    await ask(page, "akşam ne yiyeyim?");
    await expect(page.getByText("Akşam için önerim:", { exact: true })).toBeVisible();
    await expect(page.getByText(/meal_proposal/)).toHaveCount(0);
    await expect(page.getByText("Eksik malzeme")).toBeVisible();
    await expect(page.getByText("Hesaplandı", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Kalori hesaplanamadı")).toBeVisible();
    await page.getByRole("button", { name: "Yalnız adıyla plana ekle" }).click();
    await expect(page.getByText("Onaylandı", { exact: true })).toBeVisible();
    await expect(page.getByText("Onay Bekliyor")).toHaveCount(0);
  });

  test("B30: başarılı test 'kaydedildi' der; algılanan model seçilebilir ve rozet bağlı gösterir", async ({ page, api }) => {
    const original = await (await api.get("/api/ai/settings")).json();
    try {
      await page.goto("/settings#yapay-zeka");
      await page.getByLabel("Sağlayıcı").selectOption("lmstudio");
      await page.getByLabel("Base URL").fill(original.baseUrl);
      await page.getByLabel("Model Adı").fill("");
      await page.getByRole("button", { name: "Bağlantıyı Test Et" }).first().click();
      await expect(page.getByText(/^Bağlantı başarılı ve kaydedildi\. Kullanılan model: mock-llama/)).toBeVisible();
      const choice = page.getByRole("group", { name: "Algılanan modeller" }).getByRole("button", { name: "mock-llama" });
      await expect(choice).toHaveAttribute("aria-pressed", "true");
      await choice.click();
      await expect(page.getByTestId("ai-connection-badge")).toHaveText("Bağlı · mock-llama");
      expect((await (await api.get("/api/ai/settings")).json()).providerType).toBe("lmstudio");
    } finally {
      await api.post("/api/ai/test-connection", {
        data: { providerType: original.providerType, baseUrl: original.baseUrl, modelName: original.modelName },
      });
    }
  });
});
