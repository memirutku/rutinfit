import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/catalog/turkish/route";
import { prisma } from "@/lib/prisma";
import { TURKISH_DISHES } from "@/lib/turkish-catalog";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createFood } from "../helpers/factories";

beforeEach(resetDatabase);

describe("/api/catalog/turkish", () => {
  it("F74: paketi kurar; ikinci kurulum bir şey eklemez; aynı adlı mevcut besin yeniden kullanılır", async () => {
    const tomato = await createFood({ name: "Domates", calories: 20 });
    expect((await callRoute(GET)).json).toEqual({ dishes: TURKISH_DISHES.length, installed: 0 });

    const first = await callRoute(POST, { method: "POST" });
    expect(first.status).toBe(201);
    expect(first.json.recipesCreated).toBe(TURKISH_DISHES.length);
    expect(await prisma.foodItem.count({ where: { name: "Domates" } })).toBe(1);
    const menemen = await prisma.recipe.findFirstOrThrow({ where: { name: "Menemen" }, include: { ingredients: true } });
    expect(menemen.ingredients.some((i) => i.foodItemId === tomato.id)).toBe(true);
    expect(JSON.parse(menemen.tags!)).toEqual(["Türk mutfağı"]);

    const second = await callRoute(POST, { method: "POST" });
    expect(second.json).toEqual({ foodsCreated: 0, recipesCreated: 0 });
    expect((await callRoute(GET)).json.installed).toBe(TURKISH_DISHES.length);
  });
});
