import { describe, expect, it } from "vitest";
import { PROVINCES, fastingTimes, findProvince } from "@/lib/prayer-times";

describe("F76: internetsiz imsak ve iftar vakitleri", () => {
  it("Diyanet 2026 imsakiyesindeki saatlerle aynı dakikayı verir", () => {
    const ist = fastingTimes(findProvince("İstanbul")!, "2026-02-19");
    expect([ist.imsak, ist.iftar]).toEqual(["06:22", "18:49"]);
    const ank1 = fastingTimes(findProvince("Ankara")!, "2026-02-19");
    expect([ank1.imsak, ank1.iftar]).toEqual(["06:06", "18:35"]);
    const ank6 = fastingTimes(findProvince("Ankara")!, "2026-02-24");
    expect([ank6.imsak, ank6.iftar]).toEqual(["06:00", "18:41"]);
    expect(ank1.fastMinutes).toBe(12 * 60 + 29); // Diyanet: 12 sa 29 dk
  });

  it("81 il var, adlar benzersiz; doğudaki iller daha erken iftar eder", () => {
    expect(PROVINCES).toHaveLength(81);
    expect(new Set(PROVINCES.map((p) => p.name)).size).toBe(81);
    const van = fastingTimes(findProvince("Van")!, "2026-02-19");
    const izmir = fastingTimes(findProvince("İzmir")!, "2026-02-19");
    expect(van.iftar < izmir.iftar).toBe(true);
  });

  it("kullanıcı düzeltmesi dakika olarak eklenir; yazın oruç daha uzundur", () => {
    const p = findProvince("Konya")!;
    const base = fastingTimes(p, "2026-02-19");
    const adj = fastingTimes(p, "2026-02-19", { imsak: -2, iftar: 3 });
    expect(adj.fastMinutes - base.fastMinutes).toBe(5);
    expect(fastingTimes(p, "2026-06-21").fastMinutes).toBeGreaterThan(16 * 60);
  });
});
