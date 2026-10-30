import { describe, expect, it } from "vitest";
import { CARDIO_KINDS, estimateCardioKcal, formatPace, summarizeCardio } from "@/lib/cardio";

describe("F27: kardiyo hesapları", () => {
  it("MET × kilo × saat; koşuda hız biliniyorsa MET hıza göre", () => {
    expect(estimateCardioKcal({ kind: "walk", durationMin: 60, distanceKm: null }, 80)).toBe(304); // 3,8 MET
    expect(estimateCardioKcal({ kind: "run", durationMin: 30, distanceKm: 5 }, 80)).toBe(400); // 10 km/sa → 10 MET
    expect(estimateCardioKcal({ kind: "run", durationMin: 30, distanceKm: null }, 80)).toBe(392); // varsayılan 9,8
    expect(estimateCardioKcal({ kind: "cycle", durationMin: 60, distanceKm: 20 }, 70)).toBe(525);
  });

  it("tempo dk:sn/km; mesafe yoksa boş", () => {
    expect(formatPace(27.5, 5)).toBe("5:30 /km");
    expect(formatPace(30, null)).toBeNull();
    expect(formatPace(59.9, 10)).toBe("5:59 /km");
  });

  it("haftalık toplam: süre, mesafe, seans", () => {
    expect(
      summarizeCardio([
        { kind: "run", durationMin: 30, distanceKm: 5 },
        { kind: "walk", durationMin: 45, distanceKm: null },
      ])
    ).toEqual({ sessions: 2, minutes: 75, distanceKm: 5 });
  });

  it("türler Türkçe etiketli", () => {
    expect(CARDIO_KINDS.walk).toBe("Yürüyüş");
  });
});
