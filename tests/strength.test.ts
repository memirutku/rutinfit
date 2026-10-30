import { describe, expect, it } from "vitest";
import { detectPlateau, estimate1Rm, exerciseHistory, personalRecords } from "@/lib/strength";

describe("F23: e1RM (Epley)", () => {
  it("tek tekrarda ağırlığın kendisi; diğerlerinde ağırlık × (1 + tekrar/30), 0,1'e yuvarlı", () => {
    expect(estimate1Rm(100, 1)).toBe(100);
    expect(estimate1Rm(100, 5)).toBe(116.7);
    expect(estimate1Rm(0, 10)).toBe(0);
  });
});

describe("F23: egzersiz geçmişi ve rekorlar", () => {
  const sets = [
    { date: "2026-10-01", weightKg: 80, reps: 8 },
    { date: "2026-10-01", weightKg: 85, reps: 5 },
    { date: "2026-10-08", weightKg: 90, reps: 3 },
    { date: "2026-10-08", weightKg: 80, reps: 10 },
    { date: "2026-10-15", weightKg: 95, reps: 1 },
  ];

  it("gün gün en iyi e1RM'li seti, hacmi ve set sayısını verir (tarihe göre artan)", () => {
    const h = exerciseHistory(sets);
    expect(h.map((d) => d.date)).toEqual(["2026-10-01", "2026-10-08", "2026-10-15"]);
    // 80 × 8 (e1RM 101,3) 85 × 5'ten (99,2) güçlü bir settir.
    expect(h[0]).toMatchObject({ topSet: { weightKg: 80, reps: 8 }, e1rm: 101.3, volumeKg: 1065, sets: 2 });
    expect(h[1]).toMatchObject({ topSet: { weightKg: 80, reps: 10 }, e1rm: 106.7, volumeKg: 1070 });
  });

  it("rekorlar: en iyi e1RM, en ağır set ve en yüksek hacimli gün", () => {
    const pr = personalRecords(exerciseHistory(sets), sets);
    expect(pr.bestE1rm).toEqual({ value: 106.7, date: "2026-10-08", weightKg: 80, reps: 10 });
    expect(pr.heaviest).toEqual({ weightKg: 95, reps: 1, date: "2026-10-15" });
    expect(pr.bestVolume).toEqual({ volumeKg: 1070, date: "2026-10-08" });
  });

  it("ağırlıksız (vücut ağırlığı) egzersizde e1RM yok, en çok tekrar rekoru var", () => {
    const bw = [{ date: "2026-10-01", weightKg: 0, reps: 12 }, { date: "2026-10-02", weightKg: 0, reps: 15 }];
    const pr = personalRecords(exerciseHistory(bw), bw);
    expect(pr.bestE1rm).toBeNull();
    expect(pr.mostReps).toEqual({ reps: 15, date: "2026-10-02" });
  });
});

describe("F21: durağanlık", () => {
  const day = (date: string, e1rm: number) => ({ date, topSet: { weightKg: 80, reps: 5 }, e1rm, volumeKg: 400, sets: 3 });
  it("son üç seansta önceki en iyi e1RM aşılmadıysa durağan", () => {
    expect(detectPlateau([day("a", 100), day("b", 99), day("c", 100), day("d", 98)])).toEqual({ sessions: 3, bestE1rm: 100, message: expect.any(String) });
  });
  it("yeni rekor ya da yetersiz geçmişte durağanlık yok", () => {
    expect(detectPlateau([day("a", 100), day("b", 99), day("c", 101), day("d", 98)])).toBeNull();
    expect(detectPlateau([day("a", 100), day("b", 99), day("c", 98)])).toBeNull();
  });
});
