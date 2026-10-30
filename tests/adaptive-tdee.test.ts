import { describe, expect, it } from "vitest";
import { estimateAdaptiveTdee } from "@/lib/adaptive-tdee";
import { addDaysToDateString } from "@/lib/date-utils";

const TODAY = "2026-10-30";
const days = (n: number) => Array.from({ length: n }, (_, i) => addDaysToDateString(TODAY, -(n - i))); // dünden geriye n gün

describe("F10: adaptif TDEE", () => {
  it("21 gün, her gün 2000 kcal, haftada 0,5 kg kayıp → yaklaşık 2550 kcal, yüksek güven", () => {
    const d = days(21);
    const r = estimateAdaptiveTdee({
      today: TODAY,
      intakes: d.map((date) => ({ date, kcal: 2000 })),
      weights: d.map((date, i) => ({ date, kg: 100 - (0.5 / 7) * i })),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.tdee).toBeGreaterThanOrEqual(2540);
    expect(r.tdee).toBeLessThanOrEqual(2560);
    expect(r.confidence).toBe("high");
    expect(r.weightChangeKgPerWeek).toBeCloseTo(-0.5, 2);
    expect(r).toMatchObject({ avgIntake: 2000, loggedDays: 21, windowDays: 21, weighIns: 21 });
  });

  it("bugün (yarım gün) hesaba girmez; kayıtsız günler ortalamayı düşürmez", () => {
    const d = days(21);
    const intakes = d.filter((_, i) => i % 5 !== 0).map((date) => ({ date, kcal: 2200 }));
    const r = estimateAdaptiveTdee({
      today: TODAY,
      intakes: [...intakes, { date: TODAY, kcal: 300 }],
      weights: d.filter((_, i) => i % 2 === 0).map((date) => ({ date, kg: 90 })),
    });
    expect(r.ok && r.avgIntake).toBe(2200);
    expect(r.ok && r.tdee).toBe(2200);
    expect(r.ok && r.confidence).toBe("medium");
  });

  it("yetersiz veri: 14 günden az, kayıtlı gün %70'in altında ya da 5'ten az tartı", () => {
    const short = days(10);
    expect(estimateAdaptiveTdee({ today: TODAY, intakes: short.map((date) => ({ date, kcal: 2000 })), weights: short.map((date) => ({ date, kg: 90 })) })).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/14 gün/),
    });
    const d = days(21);
    expect(
      estimateAdaptiveTdee({ today: TODAY, intakes: d.slice(0, 10).map((date) => ({ date, kcal: 2000 })), weights: d.map((date) => ({ date, kg: 90 })) })
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/kayıt/) });
    expect(
      estimateAdaptiveTdee({ today: TODAY, intakes: d.map((date) => ({ date, kcal: 2000 })), weights: d.slice(0, 3).map((date) => ({ date, kg: 90 })) })
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/tartı/) });
  });
});
