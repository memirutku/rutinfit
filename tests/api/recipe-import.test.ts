import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/recipes/import-url/route";
import { previewRecipe } from "@/lib/services/recipe-import";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createFood } from "../helpers/factories";
import { installTurkishCatalog } from "@/lib/services/turkish-catalog";

beforeEach(resetDatabase);

describe("F33: tarif önizleme", () => {
  it("malzemeleri ölçüyle grama çevirir ve katalogla eşler; ölçüsüz ya da bilinmeyen malzemeyi bildirir", async () => {
    await installTurkishCatalog();
    await createFood({ name: "Bulgur (köftelik)" });
    const p = await previewRecipe(
      { name: "Mercimek Köftesi", servings: 6, prepMinutes: 45, instructions: "", ingredients: ["1 su bardağı kırmızı mercimek", "2 yemek kaşığı domates salçası", "1 kg patlıcan", "Tuz, karabiber", "1 demet taze nane"] },
      "https://ornek.com/x"
    );
    expect(p.ingredients.map((i) => [i.match?.name ?? null, i.grams])).toEqual([
      ["Kırmızı Mercimek (çiğ)", 180],
      ["Domates Salçası", 34],
      ["Patlıcan", 1000],
      [null, null],
      [null, null],
    ]);
    expect(p.ingredients[3].note).toMatch(/miktar/i);
    expect(p.sourceUrl).toBe("https://ornek.com/x");
  });
});

describe("POST /api/recipes/import-url", () => {
  it("geçersiz ve yerel adresleri ağ isteği yapmadan reddeder", async () => {
    expect((await callRoute(POST, { body: { url: "javascript:alert(1)" } })).status).toBe(400);
    expect((await callRoute(POST, { body: { url: "http://127.0.0.1:3005/api/backup/export" } })).status).toBe(400);
    expect((await callRoute(POST, { body: { url: "http://localhost/x" } })).status).toBe(400);
  });
});

describe("F33: güvenli sayfa getirme", () => {
  const lookup = async (host: string) => [{ address: host === "ic" ? "10.0.0.5" : "93.184.216.34" }];
  it("yerel adrese yönlendirmeyi izlemez", async () => {
    const { fetchRecipePage } = await import("@/lib/services/recipe-import");
    const fetchImpl = async () => new Response(null, { status: 302, headers: { location: "http://ic/gizli" } });
    await expect(fetchRecipePage("https://ornek.com/tarif", { fetchImpl, lookup })).rejects.toThrow(/Yerel/);
  });
  it("2 MB'den büyük sayfayı keser; başarılı sayfayı metin olarak döner", async () => {
    const { fetchRecipePage } = await import("@/lib/services/recipe-import");
    const big = async () => new Response("x".repeat(2 * 1024 * 1024 + 10));
    await expect(fetchRecipePage("https://ornek.com/t", { fetchImpl: big, lookup })).rejects.toThrow(/büyük/);
    const ok = async () => new Response("<html>tarif</html>");
    expect(await fetchRecipePage("https://ornek.com/t", { fetchImpl: ok, lookup })).toContain("tarif");
  });
});
