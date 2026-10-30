import { describe, expect, it } from "vitest";
import { computeReadiness } from "@/lib/readiness";

describe("F51: hazır olma skoru", () => {
  it("ağırlıklı ortalama: iyi bir gün yüksek banttadır", () => {
    const r = computeReadiness({ sleepMinutes: 480, energy1to5: 4, stress1to5: 2, soreness1to5: 1, mood1to5: 4 })!;
    expect(r.score).toBe(88);
    expect(r.band).toBe("high");
    expect(r.drags).toEqual([]);
  });

  it("kötü bir gün düşük banttadır; en çok düşürenler adlarıyla sıralanır", () => {
    const r = computeReadiness({ sleepMinutes: 300, energy1to5: 2, stress1to5: 4, soreness1to5: 4, mood1to5: 2 })!;
    expect(r.score).toBe(30);
    expect(r.band).toBe("low");
    expect(r.drags.slice(0, 2)).toEqual(["Enerji 2/5", "Uyku 5 sa"]);
  });

  it("girilmeyen alanlar ağırlıktan düşer; recheck: tek girdiyle skor verilmez (yalnız uykudan 'Yüksek' çıkmasın)", () => {
    expect(computeReadiness({ sleepMinutes: 390 })).toBeNull();
    expect(computeReadiness({ energy1to5: 4 })).toBeNull();
    expect(computeReadiness({ sleepMinutes: 420, energy1to5: 4 })).toMatchObject({ score: 78, band: "high" });
    expect(computeReadiness({ sleepMinutes: 420, soreness1to5: 5 })!.band).toBe("medium");
    expect(computeReadiness({})).toBeNull();
  });

  it("bant sınırları 45 ve 70", () => {
    expect(computeReadiness({ energy1to5: 3, mood1to5: 3 })!.score).toBe(50);
    expect(computeReadiness({ energy1to5: 3, mood1to5: 3 })!.band).toBe("medium");
    expect(computeReadiness({ energy1to5: 2, mood1to5: 2 })!.band).toBe("low");
    expect(computeReadiness({ energy1to5: 4, mood1to5: 4 })!.band).toBe("high");
  });
});
