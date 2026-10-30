import { describe, it, expect, beforeEach } from "vitest";
import { DELETE, GET, POST, PUT } from "@/app/api/workouts/route";
import { GET as lastSetsGet } from "@/app/api/workouts/last-sets/route";
import { prisma } from "@/lib/prisma";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

const session = (setLogs: any[]) => ({
  date: "2026-10-18",
  name: "Ağırlık A",
  durationMinutes: 45,
  rpe: 7,
  setLogs,
});

beforeEach(resetDatabase);

describe("POST /api/workouts", () => {
  it("seansı setleriyle kaydeder; hedef üst tekrar sınırına ulaşan set 'hedef tuttu' sayılır", async () => {
    const res = await callRoute(POST, {
      body: session([
        { exerciseName: "Bench Press", setNumber: 1, weightKg: 80, reps: 10, targetRepMin: 8, targetRepMax: 10 },
        { exerciseName: "Bench Press", setNumber: 2, weightKg: 80, reps: 8, targetRepMin: 8, targetRepMax: 10 },
      ]),
    });

    expect(res.status).toBe(201);
    const sets = await prisma.setLog.findMany({ orderBy: { setNumber: "asc" } });
    expect(sets.map((s) => s.isTargetMet)).toEqual([true, false]);
    expect(res.json.progressionFeedbacks["Bench Press"]).toBeDefined();
  });

  it("F20: set başına RPE (yarım puanlı) kaydedilir ve döner; aralık dışı RPE 400", async () => {
    const res = await callRoute(POST, {
      body: session([
        { exerciseName: "Squat", setNumber: 1, weightKg: 100, reps: 5, rpe: 8.5 },
        { exerciseName: "Squat", setNumber: 2, weightKg: 100, reps: 5 },
      ]),
    });
    expect(res.status).toBe(201);
    const sets = await prisma.setLog.findMany({ orderBy: { setNumber: "asc" } });
    expect(sets.map((s) => s.rpe)).toEqual([8.5, null]);

    const bad = await callRoute(POST, {
      body: session([{ exerciseName: "Squat", setNumber: 1, weightKg: 100, reps: 5, rpe: 11 }]),
    });
    expect(bad.status).toBe(400);
  });

  it("F19: set tipi kaydedilir; ısınma seti 'hedef tuttu' sayılmaz ve ilerleme kararına girmez", async () => {
    const res = await callRoute(POST, {
      body: session([
        { exerciseName: "Squat", setNumber: 1, weightKg: 40, reps: 5, targetRepMin: 8, targetRepMax: 10, setType: "warmup" },
        { exerciseName: "Squat", setNumber: 2, weightKg: 100, reps: 10, targetRepMin: 8, targetRepMax: 10 },
        { exerciseName: "Squat", setNumber: 3, weightKg: 100, reps: 10, targetRepMin: 8, targetRepMax: 10, setType: "failure" },
      ]),
    });
    expect(res.status).toBe(201);
    const sets = await prisma.setLog.findMany({ orderBy: { setNumber: "asc" } });
    expect(sets.map((s) => [s.setType, s.isTargetMet])).toEqual([["warmup", false], ["normal", true], ["failure", true]]);
    // Isınma (5 tekrar) hesaba girseydi "tüm setlerde üst sınır" sağlanmazdı.
    expect(res.json.progressionFeedbacks.Squat).toMatchObject({ isTargetMetAllSets: true, recommendedNextWeightKg: 102.5 });
    expect((await callRoute(POST, { body: session([{ exerciseName: "X", setNumber: 1, weightKg: 1, reps: 1, setType: "süper" }]) })).status).toBe(400);
  });

  it("F21: şablondaki egzersiz başına artış miktarı ilerleme önerisinde kullanılır", async () => {
    const tpl = await prisma.workoutTemplate.create({
      data: { name: "A", type: "strength", dayOfWeek: 1, exercises: { create: [{ exerciseName: "Deadlift", repMin: 3, repMax: 5, incrementKg: 5 }] } },
    });
    const res = await callRoute(POST, {
      body: { ...session([{ exerciseName: "Deadlift", setNumber: 1, weightKg: 140, reps: 5, targetRepMin: 3, targetRepMax: 5 }]), templateId: tpl.id },
    });
    expect(res.json.progressionFeedbacks.Deadlift.recommendedNextWeightKg).toBe(145);
  });

  it("B21: 5/3/1 ana kaldırışında öneri son setin (AMRAP) tekrarına ve döngüye göre verilir", async () => {
    const tpl = await prisma.workoutTemplate.create({
      data: {
        name: "5/3/1 · Squat",
        type: "strength",
        dayOfWeek: 5,
        exercises: { create: [{ exerciseName: "Squat", targetSets: 3, repMin: 3, repMax: 3, incrementKg: 5, loadingScheme: "531", trainingMaxKg: 140 }] },
      },
    });
    const sets = (last: number) => [
      { exerciseName: "Squat", setNumber: 1, weightKg: 97.5, reps: 3, targetRepMin: 3, targetRepMax: 3 },
      { exerciseName: "Squat", setNumber: 2, weightKg: 112.5, reps: 3, targetRepMin: 3, targetRepMax: 3 },
      { exerciseName: "Squat", setNumber: 3, weightKg: 125, reps: last, targetRepMin: 3, targetRepMax: 3 },
    ];
    const good = await callRoute(POST, { body: { ...session(sets(7)), templateId: tpl.id } });
    expect(good.json.progressionFeedbacks.Squat).toMatchObject({ isTargetMetAllSets: true, recommendedNextWeightKg: 125, badge: "progression" });
    expect(good.json.progressionFeedbacks.Squat.message).toMatch(/5\/3\/1: son sette 7 tekrar \(hedef en az 3\)/);
    expect(good.json.progressionFeedbacks.Squat.message).toMatch(/döngü sonunda \+5 kg/);

    const short = await callRoute(POST, { body: { ...session(sets(2)), templateId: tpl.id } });
    expect(short.json.progressionFeedbacks.Squat).toMatchObject({ isTargetMetAllSets: false, badge: "maintain" });
    expect(short.json.progressionFeedbacks.Squat.message).toMatch(/antrenman maksimumunu/);
  });

  it("F21: üç seanstır yeni rekor yoksa durağanlık uyarısı verir", async () => {
    const day = (d: number) => `2026-10-${String(d).padStart(2, "0")}`;
    const bench = (reps: number) => [{ exerciseName: "Bench Press", setNumber: 1, weightKg: 80, reps, targetRepMin: 6, targetRepMax: 10 }];
    await callRoute(POST, { body: { ...session(bench(8)), date: day(1) } }); // rekor
    await callRoute(POST, { body: { ...session(bench(7)), date: day(4) } });
    await callRoute(POST, { body: { ...session(bench(8)), date: day(8) } });
    const third = await callRoute(POST, { body: { ...session(bench(6)), date: day(11) } });
    expect(third.json.progressionFeedbacks["Bench Press"].plateau).toMatchObject({ sessions: 3 });
    expect(third.json.progressionFeedbacks["Bench Press"].plateau.message).toMatch(/deload/i);
  });

  it("negatif ağırlığı 400 ile reddeder ve hiçbir şey yazmaz", async () => {
    const res = await callRoute(POST, {
      body: session([{ exerciseName: "Squat", setNumber: 1, weightKg: -10, reps: 5 }]),
    });
    expect(res.status).toBe(400);
    expect(await prisma.workoutSession.count()).toBe(0);
  });
});

const oneSet = [{ exerciseName: "Squat", setNumber: 1, weightKg: 60, reps: 5 }];

describe("B17: tamamlanmamış ve boş setler kaydedilmez", () => {
  it("completed:false gönderilen setler yazılmaz; ilerleme önerisine girmez", async () => {
    const res = await callRoute(POST, {
      body: session([
        { exerciseName: "Bench Press", setNumber: 1, weightKg: 100, reps: 5, targetRepMin: 5, targetRepMax: 5, completed: true },
        { exerciseName: "Bench Press", setNumber: 2, weightKg: 40, reps: 8, targetRepMin: 5, targetRepMax: 5, completed: false },
        { exerciseName: "Barbell Row", setNumber: 1, weightKg: 40, reps: 8, completed: false },
      ]),
    });
    expect(res.status).toBe(201);
    const sets = await prisma.setLog.findMany();
    expect(sets.map((s) => [s.exerciseName, s.weightKg])).toEqual([["Bench Press", 100]]);
    expect(Object.keys(res.json.progressionFeedbacks)).toEqual(["Bench Press"]);
    expect(res.json.progressionFeedbacks["Bench Press"].currentMaxWeight).toBe(100);
  });

  it("0 tekrarlı (boş) set 400 ile reddedilir", async () => {
    const res = await callRoute(POST, { body: session([{ exerciseName: "Squat", setNumber: 1, weightKg: 60, reps: 0 }]) });
    expect(res.status).toBe(400);
    expect(await prisma.workoutSession.count()).toBe(0);
  });

  it("hiç tamamlanmış seti olmayan seans 400 döner ve yazılmaz", async () => {
    expect((await callRoute(POST, { body: session([]) })).status).toBe(400);
    const allIncomplete = await callRoute(POST, {
      body: session([{ exerciseName: "Squat", setNumber: 1, weightKg: 60, reps: 5, completed: false }]),
    });
    expect(allIncomplete.status).toBe(400);
    expect(allIncomplete.json.error).toMatch(/tamamlanmış set yok/);
    expect(await prisma.workoutSession.count()).toBe(0);
  });
});

describe("B17: GET /api/workouts/last-sets", () => {
  it("her egzersiz için son tamamlanmış seansın çalışma setlerini döner (ısınma hariç, ad eşleşmesi esnek)", async () => {
    await callRoute(POST, {
      body: { ...session([{ exerciseName: "Bench Press", setNumber: 1, weightKg: 90, reps: 5 }]), date: "2026-10-10" },
    });
    await callRoute(POST, {
      body: {
        ...session([
          { exerciseName: "bench press", setNumber: 1, weightKg: 40, reps: 10, setType: "warmup" },
          { exerciseName: "bench press", setNumber: 2, weightKg: 100, reps: 5 },
          { exerciseName: "bench press", setNumber: 3, weightKg: 102.5, reps: 3 },
        ]),
        date: "2026-10-17",
      },
    });
    const res = await lastSetsGet(new Request("http://x/api/workouts/last-sets?exercise=Bench%20Press&exercise=Squat") as any);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json["Bench Press"]).toEqual({
      date: "2026-10-17",
      sets: [
        { weightKg: 100, reps: 5 },
        { weightKg: 102.5, reps: 3 },
      ],
    });
    expect(json.Squat).toBeUndefined();
  });

  it("egzersiz verilmezse boş nesne döner", async () => {
    const res = await lastSetsGet(new Request("http://x/api/workouts/last-sets") as any);
    expect(await res.json()).toEqual({});
  });
});

describe("GET /api/workouts", () => {
  it("tarih filtresiyle yalnız o günün seanslarını döner", async () => {
    await callRoute(POST, { body: session(oneSet) });
    await callRoute(POST, { body: { ...session(oneSet), date: "2026-10-19" } });
    const res = await callRoute(GET, { query: { date: "2026-10-19" } });
    expect(res.status).toBe(200);
    expect(res.json.sessions).toHaveLength(1);
    expect(res.json.sessions[0].date).toBe("2026-10-19");
  });
});

describe("B19: seans geçmişi — sayfalı liste, düzenleme ve silme", () => {
  it("GET limit verilirse 20'den fazla seans döner; varsayılan 20; en çok 200", async () => {
    for (let d = 1; d <= 25; d++) {
      await prisma.workoutSession.create({ data: { date: `2026-09-${String(d).padStart(2, "0")}`, name: `S${d}` } });
    }
    expect((await callRoute(GET)).json.sessions).toHaveLength(20);
    const all = await callRoute(GET, { query: { limit: 50 } });
    expect(all.json.sessions).toHaveLength(25);
    expect(all.json.sessions[0].date).toBe("2026-09-25");
    expect((await callRoute(GET, { query: { limit: 5000 } })).json.sessions).toHaveLength(25);
    expect((await callRoute(GET, { query: { limit: "x" } })).json.sessions).toHaveLength(20);
  });

  it("PUT ?id seansın tarihini, adını ve setlerini değiştirir (setler tümüyle yenilenir)", async () => {
    const created = await callRoute(POST, {
      body: session([
        { exerciseName: "Squat", setNumber: 1, weightKg: 100, reps: 5 },
        { exerciseName: "Squat", setNumber: 2, weightKg: 100, reps: 5 },
      ]),
    });
    const id = created.json.session.id;
    const res = await callRoute(PUT, {
      method: "PUT",
      query: { id },
      body: { ...session([{ exerciseName: "Squat", setNumber: 1, weightKg: 102.5, reps: 4, targetRepMin: 3, targetRepMax: 5 }]), date: "2026-10-17", name: "Dünkü alt" },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ id, date: "2026-10-17", name: "Dünkü alt" });
    const sets = await prisma.setLog.findMany({ where: { workoutSessionId: id } });
    expect(sets.map((s) => [s.weightKg, s.reps, s.isTargetMet])).toEqual([[102.5, 4, false]]);
  });

  it("PUT geçersiz veride 400, bilinmeyen kimlikte 404; boş seansa izin vermez", async () => {
    const id = (await callRoute(POST, { body: session(oneSet) })).json.session.id;
    expect((await callRoute(PUT, { method: "PUT", query: { id }, body: session([]) })).status).toBe(400);
    expect((await callRoute(PUT, { method: "PUT", query: { id }, body: { ...session(oneSet), date: "dün" } })).status).toBe(400);
    expect((await callRoute(PUT, { method: "PUT", query: { id: "yok" }, body: session(oneSet) })).status).toBe(404);
    expect(await prisma.setLog.count({ where: { workoutSessionId: id } })).toBe(1);
  });

  it("DELETE ?id seansı ve setlerini siler; bilinmeyen kimlikte 404", async () => {
    const id = (await callRoute(POST, { body: session(oneSet) })).json.session.id;
    const res = await callRoute(DELETE, { method: "DELETE", query: { id } });
    expect(res.status).toBe(200);
    expect(await prisma.workoutSession.count()).toBe(0);
    expect(await prisma.setLog.count()).toBe(0);
    expect((await callRoute(DELETE, { method: "DELETE", query: { id } })).status).toBe(404);
  });
});
