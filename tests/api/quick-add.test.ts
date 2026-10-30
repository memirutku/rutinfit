import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/quick-add/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

beforeEach(resetDatabase);

describe("POST /api/quick-add", () => {
  it("F79: simit kataloğa bir kez eklenir; kayıt porsiyon gramıyla hesaplanır", async () => {
    const first = await callRoute(POST, { body: { item: "simit", date: "2026-10-30", mealType: "breakfast" } });
    expect(first.status).toBe(201);
    expect(first.json).toMatchObject({ name: "Simit (1 adet)", grams: 110, mealType: "breakfast", caloriesSnapshot: 302.5 });
    await callRoute(POST, { body: { item: "simit", date: "2026-10-30", mealType: "breakfast" } });
    expect(await prisma.foodItem.count({ where: { name: "Simit" } })).toBe(1);
    expect(await prisma.foodLog.count()).toBe(2);
  });

  it("F79: ekmek dilimi adetle çarpılır", async () => {
    const res = await callRoute(POST, { body: { item: "ekmek-dilimi", count: 2, date: "2026-10-30", mealType: "dinner" } });
    expect(res.json).toMatchObject({ name: "Beyaz Ekmek (2 dilim)", grams: 50, caloriesSnapshot: 133 });
  });

  it("bilinmeyen kalem ve geçersiz adet 400", async () => {
    expect((await callRoute(POST, { body: { item: "baklava" } })).status).toBe(400);
    expect((await callRoute(POST, { body: { item: "simit", count: 0 } })).status).toBe(400);
  });
});
