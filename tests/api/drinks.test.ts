import { beforeEach, describe, expect, it } from "vitest";
import { DELETE, GET, POST } from "@/app/api/drinks/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";
import { createProfile } from "../helpers/factories";

beforeEach(resetDatabase);

describe("/api/drinks", () => {
  it("F13: su kaydı günün özetine girer; hedef profilden gelir", async () => {
    await createProfile({ waterTargetMl: 3000 });
    const res = await callRoute(POST, { body: { date: "2026-10-30", kind: "water", ml: 500 } });
    expect(res.status).toBe(201);
    const day = await callRoute(GET, { query: { date: "2026-10-30" } });
    expect(day.json.logs).toHaveLength(1);
    expect(day.json.summary).toMatchObject({ hydrationMl: 500, waterTargetMl: 3000 });
    expect((await callRoute(GET, { query: { date: "2026-10-31" } })).json.logs).toHaveLength(0);
  });

  it("F13: hazır içecekle kayıt; kalorili içecek günlüğe kalori olarak da yazılır ve birlikte silinir", async () => {
    const res = await callRoute(POST, { body: { date: "2026-10-30", presetId: "bira" } });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ kind: "alcohol", ml: 330, alcoholG: 13 });
    const food = await prisma.foodLog.findFirstOrThrow({ where: { date: "2026-10-30" } });
    expect(food).toMatchObject({ name: "Bira (330 ml)", mealType: "extra", caloriesSnapshot: 143 });
    expect(res.json.foodLogId).toBe(food.id);

    const del = await callRoute(DELETE, { method: "DELETE", query: { id: res.json.id } });
    expect(del.status).toBe(200);
    expect(await prisma.drinkLog.count()).toBe(0);
    expect(await prisma.foodLog.count()).toBe(0);
  });

  it("F79: şekerli çay şekerin kalorisini besin günlüğüne yazar; şekersiz çay yazmaz", async () => {
    const sweet = await callRoute(POST, { body: { date: "2026-10-30", presetId: "cay", sugarCubes: 2 } });
    expect(sweet.status).toBe(201);
    expect(sweet.json).toMatchObject({ kind: "tea", caffeineMg: 30, kcal: 32 });
    expect(await prisma.foodLog.findFirstOrThrow()).toMatchObject({ name: "Çay (2 küp şeker)", caloriesSnapshot: 32, carbsSnapshot: 8 });

    await callRoute(POST, { body: { date: "2026-10-30", presetId: "cay", sugarCubes: 0 } });
    expect(await prisma.foodLog.count()).toBe(1);
    expect((await callRoute(POST, { body: { presetId: "cay", sugarCubes: 9 } })).status).toBe(400);
  });

  it("geçersiz tür ya da miktar 400; bilinmeyen hazır içecek 400; olmayan kayıt silinince 404", async () => {
    expect((await callRoute(POST, { body: { kind: "lava", ml: 100 } })).status).toBe(400);
    expect((await callRoute(POST, { body: { kind: "water", ml: 0 } })).status).toBe(400);
    expect((await callRoute(POST, { body: { presetId: "yok" } })).status).toBe(400);
    expect((await callRoute(DELETE, { method: "DELETE", query: { id: "yok" } })).status).toBe(404);
  });
});
