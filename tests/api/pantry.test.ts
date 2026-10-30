import { beforeEach, describe, expect, it } from "vitest";
import { DELETE, GET, PATCH, POST } from "@/app/api/pantry/route";
import { prisma } from "@/lib/prisma";
import { calculateNetShoppingList } from "@/lib/pantry-service";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

beforeEach(resetDatabase);

describe("/api/pantry", () => {
  it("yalnız miktar güncellenince SKT, not, birim ve kategori korunur", async () => {
    const item = await prisma.pantryItem.create({
      data: { name: "Süt", amount: 1, unit: "l", category: "Süt Ürünleri", expiryDate: "2026-10-30", notes: "Laktozsuz" },
    });
    const res = await callRoute(POST, { body: { id: item.id, name: "Süt", amount: 2 } });
    expect(res.status).toBe(200);
    const after = await prisma.pantryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after).toMatchObject({ amount: 2, unit: "l", category: "Süt Ürünleri", expiryDate: "2026-10-30", notes: "Laktozsuz" });
  });

  it("aynı isim farklı yazımla eklenince birim dönüştürülerek birleşir (1 kg + 500 g = 1.5 kg)", async () => {
    await callRoute(POST, { body: { name: "Yulaf", amount: 1, unit: "kg" } });
    await callRoute(POST, { body: { name: "yulaf ", amount: 500, unit: "gr" } });
    const items = await prisma.pantryItem.findMany();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: "Yulaf", amount: 1.5, unit: "kg" });
  });

  it("uyumsuz birimler toplanmaz, ayrı kalem olarak tutulur (6 adet + 200 g)", async () => {
    await callRoute(POST, { body: { name: "Yumurta", amount: 6, unit: "adet" } });
    await callRoute(POST, { body: { name: "Yumurta", amount: 200, unit: "g" } });
    const items = await prisma.pantryItem.findMany({ orderBy: { unit: "asc" } });
    expect(items.map((i) => [i.amount, i.unit])).toEqual([
      [6, "adet"],
      [200, "g"],
    ]);
  });

  it("PATCH delta eşzamanlı tıklamalarda kaybolmaz (+50 +50 = +100)", async () => {
    const item = await prisma.pantryItem.create({ data: { name: "Pirinç", amount: 500, unit: "g" } });
    await Promise.all([
      callRoute(PATCH, { method: "PATCH", body: { id: item.id, delta: 50 } }),
      callRoute(PATCH, { method: "PATCH", body: { id: item.id, delta: 50 } }),
    ]);
    expect((await prisma.pantryItem.findUniqueOrThrow({ where: { id: item.id } })).amount).toBe(600);
  });

  it("PATCH miktarı sıfırın altına indirmez", async () => {
    const item = await prisma.pantryItem.create({ data: { name: "Bulgur", amount: 30, unit: "g" } });
    const res = await callRoute(PATCH, { method: "PATCH", body: { id: item.id, delta: -50 } });
    expect(res.json.item.amount).toBe(0);
  });

  it("negatif miktar veya boş isim 400; bilinmeyen kalem 404", async () => {
    expect((await callRoute(POST, { body: { name: "X", amount: -5 } })).status).toBe(400);
    expect((await callRoute(POST, { body: { name: "", amount: 5 } })).status).toBe(400);
    expect((await callRoute(DELETE, { method: "DELETE", query: { id: "yok" } })).status).toBe(404);
    expect((await callRoute(PATCH, { method: "PATCH", body: { id: "yok", delta: 1 } })).status).toBe(404);
  });

  it("GET kalemleri listeler", async () => {
    await prisma.pantryItem.create({ data: { name: "Nohut", amount: 1, unit: "kg" } });
    expect((await callRoute(GET)).json.items).toHaveLength(1);
  });
});

describe("calculateNetShoppingList — karışık birimli stok", () => {
  it("uyumlu stokları dönüştürüp toplar, uyumsuz stoğu eklemez", async () => {
    await prisma.pantryItem.createMany({
      data: [
        { name: "Süt", amount: 0.5, unit: "l" },
        { name: "süt", amount: 250, unit: "ml" },
        { name: "Süt", amount: 2, unit: "adet" }, // kutu sayısı: ml'ye çevrilemez
      ],
    });
    const result = await calculateNetShoppingList([{ name: "Süt", amount: 1000, unit: "ml" }]);
    expect(result.itemsToBuy).toHaveLength(1);
    expect(result.itemsToBuy[0].amount).toBe(250);
  });
});
