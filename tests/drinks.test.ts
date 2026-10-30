import { describe, expect, it } from "vitest";
import { CAFFEINE_DAILY_LIMIT_MG, DRINK_PRESETS, summarizeDrinks } from "@/lib/drinks";

describe("F13: içecek özeti", () => {
  it("sıvı alımına alkol dışındaki her içecek sayılır; kafein ve alkol ayrı toplanır", () => {
    const s = summarizeDrinks(
      [
        { kind: "water", ml: 500, caffeineMg: 0, alcoholG: 0 },
        { kind: "tea", ml: 100, caffeineMg: 30, alcoholG: 0 },
        { kind: "coffee", ml: 65, caffeineMg: 60, alcoholG: 0 },
        { kind: "alcohol", ml: 330, caffeineMg: 0, alcoholG: 13 },
      ],
      2500
    );
    expect(s).toMatchObject({ hydrationMl: 665, waterTargetMl: 2500, caffeineMg: 90, alcoholG: 13, caffeineHigh: false });
    expect(s.standardDrinks).toBe(1.3);
    expect(s.progressPercent).toBe(27);
  });

  it("günlük kafein 400 mg'ı aşınca uyarı işaretlenir", () => {
    expect(summarizeDrinks([{ kind: "coffee", ml: 500, caffeineMg: 410, alcoholG: 0 }], 2000).caffeineHigh).toBe(true);
    expect(CAFFEINE_DAILY_LIMIT_MG).toBe(400);
  });

  it("hazır içecekler tutarlı: kimlikler benzersiz, alkollülerde kalori var, kafeinsizlerde kafein yok", () => {
    const ids = DRINK_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of DRINK_PRESETS) {
      expect(p.ml).toBeGreaterThan(0);
      if (p.kind === "alcohol") expect(p.kcal).toBeGreaterThan(0);
      if (p.kind === "water") expect(p.caffeineMg).toBe(0);
    }
    expect(DRINK_PRESETS.find((p) => p.id === "turk-kahvesi")).toMatchObject({ kind: "coffee", ml: 65 });
  });
});
