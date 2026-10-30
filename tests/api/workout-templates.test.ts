import { beforeEach, describe, expect, it } from "vitest";
import { DELETE, POST, PUT } from "@/app/api/workouts/templates/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

beforeEach(resetDatabase);

const base = {
  name: "Üst Gövde",
  type: "strength",
  dayOfWeek: 2,
  targetDurationMinutes: 50,
  notes: "İtme ağırlıklı",
  exercises: [
    { exerciseName: "Bench Press", targetSets: 4, repMin: 6, repMax: 8, restSeconds: 150 },
    { exerciseName: "Barbell Row", targetSets: 3, repMin: 8, repMax: 10, restSeconds: 120 },
  ],
};

describe("/api/workouts/templates", () => {
  it("F17: şablonu egzersiz sırasıyla oluşturur ve tamamen günceller", async () => {
    const created = await callRoute(POST, { body: base });
    expect(created.status).toBe(201);
    expect(created.json.exercises.map((e: any) => [e.exerciseName, e.orderIndex])).toEqual([
      ["Bench Press", 0],
      ["Barbell Row", 1],
    ]);

    const updated = await callRoute(PUT, {
      method: "PUT",
      query: { id: created.json.id },
      body: { ...base, name: "Üst A", exercises: [{ ...base.exercises[1] }, { exerciseName: "Lateral Raise", targetSets: 3, repMin: 12, repMax: 15, restSeconds: 60 }] },
    });
    expect(updated.status).toBe(200);
    const tpl = await prisma.workoutTemplate.findUniqueOrThrow({ where: { id: created.json.id }, include: { exercises: { orderBy: { orderIndex: "asc" } } } });
    expect(tpl.name).toBe("Üst A");
    expect(tpl.exercises.map((e) => e.exerciseName)).toEqual(["Barbell Row", "Lateral Raise"]);
  });

  it("F17: alt sınır üst sınırdan büyükse ya da gün geçersizse 400; olmayan şablon 404", async () => {
    const bad = { ...base, exercises: [{ ...base.exercises[0], repMin: 12, repMax: 8 }] };
    expect((await callRoute(POST, { body: bad })).status).toBe(400);
    expect((await callRoute(POST, { body: { ...base, dayOfWeek: 8 } })).status).toBe(400);
    expect((await callRoute(PUT, { method: "PUT", query: { id: "yok" }, body: base })).status).toBe(404);
  });

  it("F17: şablon silinince geçmiş seanslar korunur (şablon bağı kalkar)", async () => {
    const created = await callRoute(POST, { body: base });
    await prisma.workoutSession.create({ data: { date: "2026-10-28", name: "Üst Gövde", templateId: created.json.id } });
    expect((await callRoute(DELETE, { method: "DELETE", query: { id: created.json.id } })).status).toBe(200);
    expect(await prisma.workoutTemplate.count()).toBe(0);
    expect(await prisma.workoutSession.findFirstOrThrow()).toMatchObject({ name: "Üst Gövde", templateId: null });
    expect((await callRoute(DELETE, { method: "DELETE", query: { id: created.json.id } })).status).toBe(404);
  });
});
