import { describe, expect, it } from "vitest";
import { computeAdherence } from "@/lib/adherence";

describe("F78: plana uyum", () => {
  it("uygulandı 1, kısmen 0,5, atlandı 0 puan; işaretlenmemiş öğün hesaba girmez", () => {
    expect(computeAdherence([{ adherence: "done" }, { adherence: "partial" }, { adherence: "skipped" }, { adherence: null }])).toEqual({
      planned: 4,
      marked: 3,
      done: 1,
      partial: 1,
      skipped: 1,
      percent: 50,
    });
  });

  it("hiç işaret yoksa yüzde yoktur", () => {
    expect(computeAdherence([{ adherence: null }]).percent).toBeNull();
    expect(computeAdherence([]).percent).toBeNull();
  });
});
