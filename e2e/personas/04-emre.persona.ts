import { test, expect } from "@playwright/test";
import { baseFor, fillWizard, journey, saveWizard } from "./harness";

/**
 * Emre, 30, yazılımcı, İstanbul. Ramazan'da oruç tutuyor; sahurda ve iftarda ne yediğini takip
 * edip kilosunu korumak, oruçluyken su hatırlatması almamak istiyor. Hurma, pide, çorba yer.
 * Bilgisayarında yerel model kurulu DEĞİL.
 */
const BASE = baseFor(3);

test("Emre: Ramazan, sahur/iftar ve su", async ({ page }) => {
  const { step } = journey(page, "emre", { yaş: 30, cinsiyet: "erkek", boy: 178, kilo: 82, hedef: "kiloyu korumak", özel: "Ramazan orucu, İstanbul", yerelModel: "yok" });

  await step("İlk açılış ve sihirbaz", "Profilini girer; kilosunu korumak ister", async () => {
    await page.goto(BASE);
    await fillWizard(page, { sex: "Erkek", age: 30, height: 178, weight: 82, activity: /Hafif hareketli/, goal: "Kiloyu koru", dayPattern: "Evden / esnek", ramadanProvince: "İstanbul", program: /Tam vücut başlangıç/ });
    await saveWizard(page);
  });
  await step("Ramazan ayarını arar", "Ayarlarda Ramazan/oruç seçeneğini bulmaya çalışır", async () => {
    await page.getByRole("link", { name: "Ayarlar", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Oruç ve Ramazan" })).toBeVisible();
  });
  await step("Ramazan modunu açar", "Ramazan modunu açar, ili İstanbul seçer ve kaydeder", async () => {
    await page.getByLabel("Ramazan modu").check();
    await page.getByLabel("İl", { exact: true }).selectOption("İstanbul");
    // B34: ayarlar dokununca kaydedilir (eski sürümde ayrı düğme vardı).
    const saveBtn = page.getByRole("button", { name: "Oruç ayarlarını kaydet" });
    if (await saveBtn.isVisible().catch(() => false)) await saveBtn.click();
    await expect(page.getByText("Kaydedildi ✓")).toBeVisible();
  });
  await step("Panoda geri sayım", "Ana panelde imsak/iftar vakitlerini ve iftara kalan süreyi görür", async () => {
    await page.getByRole("link", { name: "Ana Panel", exact: true }).first().click();
    // Dalga 6 (B26): Ramazan dışında başlık "Ramazan modu" olur ve Ramazan'a kalan gün yazar.
    await expect(page.getByText(/^Ramazan( modu)? · İstanbul$/).first()).toBeVisible();
  });
  await step("Hurmayı elle ekler", "Etiketteki değerlerle kendi hurmasını ekler (100 g: 282 kcal, 2,5 P, 75 K, 0,4 Y)", async () => {
    await page.getByRole("link", { name: "Besin & Tarif", exact: true }).first().click();
    await page.getByRole("button", { name: "Yeni Besin" }).click();
    const d = page.getByRole("dialog", { name: "Yeni Besin Ekle" });
    await d.getByLabel("Besin Adı").fill("Hurma");
    await d.getByLabel(/^Kalori/).fill("282");
    await d.getByLabel(/^Protein/).fill("2,5");
    await d.getByLabel(/^Karbonhidrat/).fill("75");
    await d.getByLabel(/^Yağ/).fill("0,4");
    await d.getByRole("button", { name: "Kaydet" }).click();
    await d.waitFor({ state: "hidden" });
  });
  await step("İftarı kaydeder", "Hızlı öğünde 'İftar' seçip 3 hurma (30 g) ekler", async () => {
    await page.getByRole("link", { name: "Ana Panel", exact: true }).first().click();
    await page.getByRole("button", { name: "Hızlı Öğün Ekle" }).click();
    const d = page.getByRole("dialog", { name: "Hızlı Öğün Kaydı" });
    await d.getByLabel("Öğün Türü").selectOption({ label: "İftar" });
    await d.getByRole("searchbox", { name: "Besin ara" }).fill("hurma");
    await d.getByLabel(/^Miktar/).fill("30");
    await d.getByRole("button", { name: "Ekle" }).click();
    await d.waitFor({ state: "hidden" });
  });
  await step("Mercimek çorbası ve pide", "İftara mercimek çorbası ve pide eklemek için yazarak ekler", async () => {
    await page.getByRole("button", { name: /Yazarak ekle/ }).first().click();
    const d = page.getByRole("dialog", { name: "Yazarak öğün ekle" });
    await d.getByLabel("Ne yedin?").fill("1 kase mercimek çorbası, yarım ramazan pidesi");
    await d.getByRole("button", { name: "Çözümle" }).click();
    await d.getByRole("button", { name: /kalemi kaydet/ }).click({ timeout: 4000 });
  });
  await step("Yazarak eklemeyi kapatır", "Eşleşme yoksa pencereyi kapatır", async () => {
    await page.keyboard.press("Escape");
  });
  await step("Su hatırlatması kurar", "Akşam için 21:00'de su hatırlatması kurar", async () => {
    await page.getByRole("link", { name: "Ayarlar", exact: true }).first().click();
    await page.locator("#rem-kind").selectOption("water");
    await page.locator("#rem-time").fill("21:00");
    await page.getByRole("button", { name: "Hatırlatma ekle" }).click();
    await expect(page.getByText(/21:00 · Su iç/)).toBeVisible();
  });
  await step("Koça iftar menüsü sorar", "AI koçuna 'İftarda kilomu korumak için ne yemeliyim?' diye sorar", async () => {
    await page.getByRole("link", { name: "AI Koçu", exact: true }).first().click();
    await page.getByPlaceholder(/Sorunuzu yazın/).fill("İftarda kilomu korumak için ne yemeliyim?");
    await page.getByRole("button", { name: /Gönder/ }).click();
    await page.waitForTimeout(3000);
    await expect(page.getByText(/iftar/i).nth(1)).toBeVisible();
  });
  await step("Panoda gün sonu", "İftar sonrası panodaki toplamlara ve su önerisine bakar", async () => {
    await page.getByRole("link", { name: "Ana Panel", exact: true }).first().click();
    await expect(page.getByText(/İftar/).first()).toBeVisible();
  });
});
