import { describe, expect, it } from "vitest";
import { computeMuscleLoad } from "@/lib/muscle-load";

const muscles = [
  { muscleId: "chest", exercises: ["Bench Press", "Dumbbell Press"], weeklySets: 99, lastTrainedDaysAgo: 0 },
  { muscleId: "legs", exercises: ["Squat"], weeklySets: 99, lastTrainedDaysAgo: 0 },
];

describe("computeMuscleLoad", () => {
  it("son 7 günün tamamlanmış setlerini sayar, sahte varsayılanı kullanmaz", () => {
    const result = computeMuscleLoad(
      muscles,
      [
        { date: "2026-10-20", setLogs: [{ exerciseName: "Bench Press (Barbell)" }, { exerciseName: "Bench Press" }] },
        { date: "2026-10-17", setLogs: [{ exerciseName: "bench press" }, { exerciseName: "Squat" }] },
        { date: "2026-10-10", setLogs: [{ exerciseName: "Squat" }] }, // 7 günden eski
        { date: "2026-10-19", completed: false, setLogs: [{ exerciseName: "Squat" }] }, // planlanmış, yapılmamış
      ],
      "2026-10-20"
    );
    expect(result.find((m) => m.muscleId === "chest")).toMatchObject({ weeklySets: 3, lastTrainedDaysAgo: 0 });
    expect(result.find((m) => m.muscleId === "legs")).toMatchObject({ weeklySets: 1, lastTrainedDaysAgo: 3 });
  });

  it("kayıt yoksa 0 set ve tanımsız son gün", () => {
    const [chest] = computeMuscleLoad(muscles, [], "2026-10-20");
    expect(chest.weeklySets).toBe(0);
    expect(chest.lastTrainedDaysAgo).toBeUndefined();
  });
});
