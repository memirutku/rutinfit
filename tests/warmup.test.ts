import { describe, expect, it } from "vitest";
import { platesPerSide } from "@/lib/plates";
import { warmupSets } from "@/lib/warmup";

describe("plaka hesabı (bileşenden çıkarıldı)", () => {
  it("her tarafa en büyük plakalardan başlar; artanı bildirir", () => {
    expect(platesPerSide(100, 20)).toEqual({ perSideWeight: 40, plates: [{ weight: 25, count: 1 }, { weight: 15, count: 1 }], remainder: 0 });
    expect(platesPerSide(61, 20).remainder).toBe(0.5);
    expect(platesPerSide(15, 20)).toEqual({ perSideWeight: 0, plates: [], remainder: 0 });
  });
});

describe("F22: ısınma setleri", () => {
  it("boş bar × 10, sonra %40 × 5, %60 × 3, %80 × 2; 2,5 kg'a yuvarlanır", () => {
    expect(warmupSets(80, 20).map((s) => [s.weightKg, s.reps])).toEqual([
      [20, 10],
      [32.5, 5],
      [47.5, 3],
      [65, 2],
    ]);
  });

  it("ağır çalışma setinde %90 × 1 eklenir; her setin plakaları verilir", () => {
    const sets = warmupSets(140, 20);
    expect(sets.map((s) => s.weightKg)).toEqual([20, 55, 85, 112.5, 125]);
    expect(sets[1].plates).toEqual([{ weight: 15, count: 1 }, { weight: 2.5, count: 1 }]);
  });

  it("bara yakın ya da tekrarlayan ağırlıklar atlanır; çalışma ağırlığı bara eşitse ısınma yok", () => {
    expect(warmupSets(30, 20).map((s) => s.weightKg)).toEqual([20, 25]);
    expect(warmupSets(20, 20)).toEqual([]);
  });
});
