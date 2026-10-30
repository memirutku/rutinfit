import { describe, expect, it } from "vitest";
import { ramadanInfo } from "@/lib/ramadan-calendar";

describe("B26: Ramazan takvimi (internetsiz)", () => {
  it("Diyanet takviminin ilk ve son oruç günlerini verir (2024–2026)", () => {
    expect(ramadanInfo("2026-02-19")).toMatchObject({ inRamadan: true, day: 1, start: "2026-02-19", end: "2026-03-19" });
    expect(ramadanInfo("2026-03-19")).toMatchObject({ inRamadan: true, day: 29 });
    expect(ramadanInfo("2025-03-01")).toMatchObject({ inRamadan: true, day: 1, end: "2025-03-29" });
    expect(ramadanInfo("2024-04-09")).toMatchObject({ inRamadan: true, start: "2024-03-11" });
  });

  it("Ramazan dışında bir sonrakine kalan günü verir", () => {
    expect(ramadanInfo("2026-02-18")).toMatchObject({ inRamadan: false, day: null, start: "2026-02-19", daysUntil: 1 });
    // Bayram günü Ramazan değildir; sıradaki 2027 Ramazanı (Ümmü'l-Kurâ takvimi)
    const bayram = ramadanInfo("2026-03-20")!;
    expect(bayram.inRamadan).toBe(false);
    expect(bayram.start).toBe("2027-02-08");
    expect(ramadanInfo("2026-10-30")).toMatchObject({ inRamadan: false, start: "2027-02-08", daysUntil: 101 });
  });

  it("tabloda olmayan yıllar Ümmü'l-Kurâ takviminden 29–30 gün olarak hesaplanır", () => {
    const r = ramadanInfo("2029-06-01")!;
    expect(r.inRamadan).toBe(false);
    const first = ramadanInfo(r.start)!;
    expect(first).toMatchObject({ inRamadan: true, day: 1 });
    const days = ramadanInfo(r.end)!.day!;
    expect(days).toBeGreaterThanOrEqual(29);
    expect(days).toBeLessThanOrEqual(30);
  });
});
