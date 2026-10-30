import { beforeEach, describe, expect, it } from "vitest";
import { DELETE, GET, POST } from "@/app/api/foods/measures/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createFood } from "../helpers/factories";

beforeEach(resetDatabase);

describe("/api/foods/measures", () => {
  it("F73: yerleşik ve kullanıcı ölçülerini birleştirir; kullanıcı ölçüsü eklenir ve silinir", async () => {
    const oats = await createFood({ name: "Yulaf Ezmesi" });
    const res = await callRoute(GET, { query: { foodId: oats.id } });
    expect(res.json.measures).toEqual(expect.arrayContaining([expect.objectContaining({ name: "yemek kaşığı", grams: 8, source: "builtin" })]));

    const added = await callRoute(POST, { body: { foodItemId: oats.id, name: "yemek kaşığı", grams: 10 } });
    expect(added.status).toBe(201);
    const after = (await callRoute(GET, { query: { foodId: oats.id } })).json.measures;
    expect(after.filter((m: any) => m.name === "yemek kaşığı")).toEqual([expect.objectContaining({ grams: 10, source: "custom" })]);

    expect((await callRoute(DELETE, { method: "DELETE", query: { id: added.json.id } })).status).toBe(200);
    expect(await prisma.foodMeasure.count()).toBe(0);
  });

  it("F73: ?all=1 bütün kullanıcı ölçülerini besin kimliğiyle verir", async () => {
    const a = await createFood({ name: "A" });
    await callRoute(POST, { body: { foodItemId: a.id, name: "kase", grams: 150 } });
    const res = await callRoute(GET, { query: { all: "1" } });
    expect(res.json.custom).toEqual([expect.objectContaining({ foodItemId: a.id, name: "kase", grams: 150 })]);
  });

  it("geçersiz ölçü 400, olmayan besin 404; aynı adlı ikinci kullanıcı ölçüsü öncekini günceller", async () => {
    const food = await createFood({ name: "Kefir" });
    expect((await callRoute(POST, { body: { foodItemId: food.id, name: "kova", grams: 10 } })).status).toBe(400);
    expect((await callRoute(POST, { body: { foodItemId: food.id, name: "kase", grams: 0 } })).status).toBe(400);
    expect((await callRoute(GET, { query: { foodId: "yok" } })).status).toBe(404);
    await callRoute(POST, { body: { foodItemId: food.id, name: "kase", grams: 200 } });
    await callRoute(POST, { body: { foodItemId: food.id, name: "kase", grams: 220 } });
    expect(await prisma.foodMeasure.findMany()).toEqual([expect.objectContaining({ name: "kase", grams: 220 })]);
  });
});
