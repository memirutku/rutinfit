import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/food-logs/parse/route";
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
      ["Mercimek Çorbası", 250],
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
    const res = await callRoute(POST, { body: { text: "2 kase bulgur pilavı, 1 kase domates" } });
    const [pilav, tomato] = res.json.items;
    expect(pilav.match.name).toBe("Bulgur Pilavı");
    expect(pilav.note).toMatch(/porsiyon/);
    expect(tomato.match.name).toBe("Domates");
    expect(tomato.grams).toBe(100);
    expect(tomato.note).toMatch(/100 g/);
    expect(Array.isArray(pilav.alternatives)).toBe(true);
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

  it("boş metin 400", async () => {
    expect((await callRoute(POST, { body: { text: "  " } })).status).toBe(400);
  });
});
