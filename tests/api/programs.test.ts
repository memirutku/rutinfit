import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/workouts/programs/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

beforeEach(resetDatabase);

describe("/api/workouts/programs", () => {
  it("F18: programları özetler", async () => {
    const res = await callRoute(GET);
    expect(res.json.map((p: any) => p.id)).toContain("ev-vucut-agirligi");
    expect(res.json[0]).toHaveProperty("daysPerWeek");
  });

  it("F18: 'yerine' mevcut şablonları siler (seanslar kalır); 'ekle' korur", async () => {
    const old = await prisma.workoutTemplate.create({ data: { name: "Eski", type: "strength", dayOfWeek: 2 } });
    await prisma.workoutSession.create({ data: { date: "2026-10-28", name: "Eski", templateId: old.id } });

    const added = await callRoute(POST, { body: { programId: "ev-vucut-agirligi", mode: "add" } });
    expect(added.status).toBe(201);
    expect(await prisma.workoutTemplate.count()).toBe(4);

    const replaced = await callRoute(POST, { body: { programId: "ust-alt", mode: "replace" } });
    expect(replaced.json.created).toBe(4);
    const names = (await prisma.workoutTemplate.findMany({ orderBy: { dayOfWeek: "asc" } })).map((t) => t.name);
    expect(names).toEqual(["Üst Gövde A", "Alt Gövde A", "Üst Gövde B", "Alt Gövde B"]);
    expect(await prisma.workoutSession.count()).toBe(1);
    expect((await prisma.workoutExercise.findFirstOrThrow({ where: { exerciseName: "Squat" } })).incrementKg).toBe(5);
  });

  it("bilinmeyen program 404", async () => {
    expect((await callRoute(POST, { body: { programId: "yok", mode: "add" } })).status).toBe(404);
  });
});
