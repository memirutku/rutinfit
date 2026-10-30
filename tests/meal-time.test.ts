import { describe, expect, it } from "vitest";
import { plannedMealLogTime } from "@/lib/meal-time";

describe("recheck (Zeynep): planlı öğün kaydının saati", () => {
  it("planlanan saat varsa onu, yoksa öğün türünün olağan saatini kullanır (kayıt anını değil)", () => {
    expect(plannedMealLogTime("breakfast", "07:45")).toBe("07:45");
    expect(plannedMealLogTime("breakfast", null)).toBe("08:00");
    expect(plannedMealLogTime("lunch")).toBe("12:30");
    expect(plannedMealLogTime("workSnack")).toBe("16:00");
    expect(plannedMealLogTime("dinner")).toBe("19:00");
    expect(plannedMealLogTime("extra", null, new Date(2026, 9, 30, 21, 5))).toBe("21:05");
  });
});
