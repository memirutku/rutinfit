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

  it("B21: GET seviye ve 1RM istenen kaldırışları döner", async () => {
    const res = await callRoute(GET);
    const w = res.json.find((p: any) => p.id === "wendler-531");
    expect(w).toMatchObject({ level: "İleri", oneRepMaxLifts: ["Overhead Press", "Deadlift", "Bench Press", "Squat"] });
  });

  it("B21: 5/3/1 uygulanırken TM girilen 1RM'den, yoksa e1RM geçmişinden %90 hesaplanır; ikisi de yoksa boş kalır", async () => {
    const s = await prisma.workoutSession.create({ data: { date: "2026-10-01", name: "Eski", completed: true } });
    // Squat 140 × 5 → e1RM 163,3 → TM 145
    await prisma.setLog.create({ data: { workoutSessionId: s.id, exerciseName: "squat", setNumber: 1, weightKg: 140, reps: 5 } });
    // Isınma seti hesaba girmez
    await prisma.setLog.create({ data: { workoutSessionId: s.id, exerciseName: "Deadlift", setNumber: 1, weightKg: 300, reps: 5, setType: "warmup" } });

    const res = await callRoute(POST, { body: { programId: "wendler-531", mode: "replace", oneRepMaxes: { "Bench Press": 100, "Overhead Press": 0 } } });
    expect(res.status).toBe(201);
    const main = await prisma.workoutExercise.findMany({ where: { loadingScheme: "531" } });
    const tm = Object.fromEntries(main.map((e) => [e.exerciseName, e.trainingMaxKg]));
    expect(tm).toEqual({ "Bench Press": 90, Squat: 145, Deadlift: null, "Overhead Press": null });
    expect(await prisma.workoutExercise.count({ where: { loadingScheme: null, trainingMaxKg: { not: null } } })).toBe(0);

    const bad = await callRoute(POST, { body: { programId: "wendler-531", mode: "add", oneRepMaxes: { Squat: -5 } } });
    expect(bad.status).toBe(400);
  });
});
