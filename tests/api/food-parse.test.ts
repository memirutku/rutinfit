import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/food-logs/parse/route";
import { GET as RECIPES } from "@/app/api/recipes/route";
import { installTurkishCatalog } from "@/lib/services/turkish-catalog";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createFood } from "../helpers/factories";
import { prisma } from "@/lib/prisma";

beforeEach(resetDatabase);

describe("POST /api/food-logs/parse", () => {
  it("F06: her parçayı katalogla eşler; gram ölçüden, değerler katalogdan gelir", async () => {
    await installTurkishCatalog();
    await createFood({ name: "Tam Buğday Ekmeği", calories: 245, proteinG: 9, carbsG: 41, fatG: 3.4 });
    const res = await callRoute(POST, { body: { text: "1 kase mercimek çorbası, 2 dilim ekmek, 3 yumurta, 150 gr tavuk göğsü, ejder meyvesi" } });
    expect(res.status).toBe(200);
    const items = res.json.items;
    expect(items.map((i: any) => [i.match?.name ?? null, i.grams])).toEqual([
      ["Mercimek Çorbası", 248.8],
      ["Tam Buğday Ekmeği", 60],
      ["Yumurta (büyük boy, adet ~50g)", 150],
      ["Tavuk Göğsü (çiğ)", 150],
      [null, null],
    ]);
    expect(items[0].match.type).toBe("recipe");
    expect(items[1].macros.calories).toBe(147);
    expect(items[2].macros.calories).toBeCloseTo(214.5, 1);
    expect(items[4].note).toMatch(/bulunamadı/);
    // B10: istemci yeni besin adını ayrıştırılan metinden önerir.
    expect(items[4].food).toBe("ejder meyvesi");
  });

  it("F06: ölçü bilinmiyorsa porsiyon/100 g sayılır ve not düşülür; alternatifler verilir", async () => {
    await installTurkishCatalog();
    const res = await callRoute(POST, { body: { text: "2 avuç bulgur pilavı, 1 kase domates" } });
    const [pilav, tomato] = res.json.items;
    expect(pilav.match.name).toBe("Bulgur Pilavı");
    expect(pilav.note).toMatch(/porsiyon/);
    expect(tomato.match.name).toBe("Domates");
    expect(tomato.grams).toBe(100);
    expect(tomato.note).toMatch(/100 g/);
    expect(Array.isArray(pilav.alternatives)).toBe(true);
  });

  it("B11: '1 kase' çorba tarif kartındaki porsiyonla aynı kaloriyi verir (~250 g)", async () => {
    await installTurkishCatalog();
    const recipes = (await callRoute(RECIPES)).json as Array<{ name: string; servings: number; calculatedMacros: { calories: number } }>;
    const soup = recipes.find((r) => r.name === "Mercimek Çorbası")!;
    const cardKcal = Math.round(soup.calculatedMacros.calories / soup.servings);
    const res = await callRoute(POST, { body: { text: "1 kase mercimek çorbası, 2 kase yayla çorbası, 1 kepçe mercimek çorbası, 1 porsiyon kısır" } });
    const [bowl, two, ladle, kisir] = res.json.items;
    expect(Math.round(bowl.macros.calories)).toBe(cardKcal);
    expect(bowl.grams).toBeGreaterThanOrEqual(240);
    expect(bowl.grams).toBeLessThanOrEqual(260);
    expect(bowl.note).toBeUndefined();
    expect(two.match.name).toBe("Yayla Çorbası");
    expect(two.note).toBeUndefined();
    expect(ladle.grams).toBe(120);
    expect(kisir.note).toBeUndefined();

    // Tarifin kendi porsiyon ölçüsü ("Porsiyon: 1 su bardağı") da bir porsiyondur.
    const ayran = recipes.find((r) => r.name === "Ayran")!;
    const [glass] = (await callRoute(POST, { body: { text: "1 su bardağı ayran" } })).json.items;
    expect(Math.round(glass.macros.calories)).toBe(Math.round(ayran.calculatedMacros.calories / ayran.servings));
  });

  it("B26: Ramazan sofrası yazarak eklenir (pide, hurma, güllaç)", async () => {
    await installTurkishCatalog();
    const res = await callRoute(POST, { body: { text: "yarım ramazan pidesi, 3 hurma, 1 dilim güllaç, 5 zeytin, 1 dilim beyaz peynir" } });
    const [pide, dates, gullac, olives, cheese] = res.json.items;
    expect(pide.match.name).toBe("Ramazan Pidesi");
    expect(pide.grams).toBe(125);
    expect(dates.match.name).toBe("Hurma (kuru)");
    expect(dates.grams).toBe(24);
    expect(gullac.match).toMatchObject({ type: "recipe", name: "Güllaç" });
    expect(gullac.note).toBeUndefined();
    expect(olives.match.name).toMatch(/^Zeytin \(/);
    expect(olives.grams).toBe(20);
    expect(cheese.match.name).toBe("Beyaz Peynir");
    expect(cheese.grams).toBe(30);
  });

  it("B10: katalogda karşılığı olmayan hızlı kalem (ekmek, simit) yine eşlenir", async () => {
    const res = await callRoute(POST, { body: { text: "2 dilim ekmek, 1 simit" } });
    const [bread, simit] = res.json.items;
    expect(bread.match).toMatchObject({ type: "food", name: "Beyaz Ekmek" });
    expect(bread.grams).toBe(50);
    expect(bread.macros.calories).toBe(133);
    expect(simit.match.name).toBe("Simit");
    expect(simit.grams).toBe(110);
    // Kalem kataloğa hızlı ekleme çipinin bulacağı biçimde bir kez girer.
    expect(await prisma.foodItem.count({ where: { name: "Beyaz Ekmek", source: "RutinFit" } })).toBe(1);
    await callRoute(POST, { body: { text: "1 dilim ekmek" } });
    expect(await prisma.foodItem.count({ where: { name: "Beyaz Ekmek" } })).toBe(1);
    // Hızlı kalem eşlenip kataloğa girdiği için katalog artık boş sayılmaz.
    expect(res.json.catalogEmpty).toBe(false);
  });

  it("B10: '5 zeytin' zeytinyağına değil zeytine eşlenir", async () => {
    await createFood({ name: "Zeytinyağı", calories: 884, proteinG: 0, carbsG: 0, fatG: 100 });
    await createFood({ name: "Siyah zeytin", calories: 115, proteinG: 0.8, carbsG: 6.3, fatG: 10.7 });
    const [olives] = (await callRoute(POST, { body: { text: "5 zeytin" } })).json.items;
    expect(olives.match.name).toBe("Siyah zeytin");
  });

  it("boş metin 400", async () => {
    expect((await callRoute(POST, { body: { text: "  " } })).status).toBe(400);
  });
});
