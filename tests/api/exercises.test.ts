import { beforeEach, describe, expect, it } from "vitest";
import { DELETE, GET, POST } from "@/app/api/exercises/route";
import { callRoute } from "../helpers/route";
import { resetDatabase } from "../helpers/db";

beforeEach(resetDatabase);

describe("/api/exercises", () => {
  it("F25: kütüphaneyi süzer; benzer egzersizleri verir", async () => {
    const list = (await callRoute(GET, { query: { muscle: "chest", equipment: "bodyweight" } })).json;
    // Kas süzgeci yardımcı kası da sayar: dips göğsü de çalıştırır.
    expect(list.map((e: any) => e.id)).toEqual(["dips", "pushup"]);
    const alts = (await callRoute(GET, { query: { alternativesFor: "Bench Press" } })).json;
    expect(alts.exercise.id).toBe("bench-press");
    expect(alts.alternatives.length).toBeGreaterThan(2);
    expect((await callRoute(GET, { query: { alternativesFor: "Zumba" } })).status).toBe(404);
  });

  it("F25: özel egzersiz eklenir, listede ve benzerlerde görünür, silinir; aynı ad 409", async () => {
    const res = await callRoute(POST, {
      body: { name: "Landmine Press", nameTr: "Landmine pres", primary: "chest", secondary: ["front_delts"], equipment: "barbell", cues: ["Barı göğüs hizasından it."] },
    });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ name: "Landmine Press", isCustom: true });
    expect((await callRoute(GET, { query: { search: "landmine" } })).json.map((e: any) => e.name)).toEqual(["Landmine Press"]);
    const alts = (await callRoute(GET, { query: { alternativesFor: "Bench Press" } })).json.alternatives.map((e: any) => e.name);
    expect(alts).toContain("Landmine Press");

    expect((await callRoute(POST, { body: { name: "bench press", primary: "chest", equipment: "barbell" } })).status).toBe(409);
    expect((await callRoute(POST, { body: { name: "X", primary: "kalp", equipment: "barbell" } })).status).toBe(400);

    expect((await callRoute(DELETE, { method: "DELETE", query: { id: res.json.id } })).status).toBe(200);
    expect((await callRoute(GET, { query: { search: "landmine" } })).json).toEqual([]);
    expect((await callRoute(DELETE, { method: "DELETE", query: { id: "bench-press" } })).status).toBe(404);
  });
});
