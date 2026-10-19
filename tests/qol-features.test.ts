import { describe, it, expect } from "vitest";

describe("QoL Özellikleri Birim Testleri", () => {
  describe("Son Kullanılan Besinler (Recent Foods) LIFO Mantığı", () => {
    it("Yeni besin eklendiğinde en başa yerleşmeli ve en fazla 5 öğe tutmalı", () => {
      let recents: { id: string; name: string; defaultGrams: number }[] = [
        { id: "1", name: "Tavuk Göğsü", defaultGrams: 150 },
        { id: "2", name: "Pirinç", defaultGrams: 200 },
        { id: "3", name: "Yulaf", defaultGrams: 60 },
        { id: "4", name: "Yumurta", defaultGrams: 100 },
        { id: "5", name: "Muz", defaultGrams: 120 },
      ];

      // Yeni besin ekleme: Zeytinyağı
      const newFood = { id: "6", name: "Zeytinyağı", defaultGrams: 15 };
      recents = [newFood, ...recents.filter((r) => r.id !== newFood.id)].slice(0, 5);

      expect(recents.length).toBe(5);
      expect(recents[0].id).toBe("6");
      expect(recents.map((r) => r.id)).toEqual(["6", "1", "2", "3", "4"]);
      expect(recents.some((r) => r.id === "5")).toBe(false);
    });

    it("Var olan bir besin tekrar eklendiğinde mükerrer oluşturmayıp en başa taşınmalı", () => {
      let recents = [
        { id: "1", name: "Tavuk Göğsü", defaultGrams: 150 },
        { id: "2", name: "Pirinç", defaultGrams: 200 },
        { id: "3", name: "Yulaf", defaultGrams: 60 },
      ];

      const readdedFood = { id: "2", name: "Pirinç", defaultGrams: 220 };
      recents = [readdedFood, ...recents.filter((r) => r.id !== readdedFood.id)].slice(0, 5);

      expect(recents.length).toBe(3);
      expect(recents[0].id).toBe("2");
      expect(recents[0].defaultGrams).toBe(220);
      expect(recents[1].id).toBe("1");
      expect(recents[2].id).toBe("3");
    });
  });

  describe("Geri Alma (Undo) Yük Bütünlüğü", () => {
    it("Öğün silindiğinde geri alma yükü tam besin snapshot değerlerini korumalı", () => {
      const originalLog = {
        id: "log-123",
        date: "2026-10-18",
        time: "19:45",
        mealType: "dinner",
        name: "Izgara Somon",
        grams: 200,
        caloriesSnapshot: 416,
        proteinSnapshot: 40.0,
        carbsSnapshot: 0.0,
        fatSnapshot: 26.0,
      };

      const undoToast = {
        id: originalLog.id,
        name: originalLog.name,
        calories: originalLog.caloriesSnapshot,
        action: "deleted" as const,
        payload: {
          date: originalLog.date,
          time: originalLog.time,
          mealType: originalLog.mealType,
          name: originalLog.name,
          grams: originalLog.grams,
          caloriesSnapshot: originalLog.caloriesSnapshot,
          proteinSnapshot: originalLog.proteinSnapshot,
          carbsSnapshot: originalLog.carbsSnapshot,
          fatSnapshot: originalLog.fatSnapshot,
        },
      };

      expect(undoToast.payload.name).toBe("Izgara Somon");
      expect(undoToast.payload.caloriesSnapshot).toBe(416);
      expect(undoToast.payload.proteinSnapshot).toBe(40.0);
    });
  });

  describe("Antrenman Set Tamamlama & Draft Mantığı", () => {
    it("Set tamamlandığında isTargetMet doğru türetilmeli", () => {
      const sets = [
        { exerciseName: "Bench Press", setNumber: 1, weightKg: 80, reps: 10, targetRepMin: 8, targetRepMax: 10, completed: true },
        { exerciseName: "Bench Press", setNumber: 2, weightKg: 80, reps: 8, targetRepMin: 8, targetRepMax: 10, completed: true },
        { exerciseName: "Bench Press", setNumber: 3, weightKg: 80, reps: 6, targetRepMin: 8, targetRepMax: 10, completed: false },
      ];

      const mapped = sets.map((s) => ({
        ...s,
        isTargetMet: s.completed ?? (s.reps >= s.targetRepMin),
      }));

      expect(mapped[0].isTargetMet).toBe(true);
      expect(mapped[1].isTargetMet).toBe(true);
      expect(mapped[2].isTargetMet).toBe(false);
    });

    it("Yarım kalan antrenman taslağında tamamlanan set sayısı hesaplanabilmeli", () => {
      const draft = {
        name: "Göğüs & Sırt Seansı",
        setLogs: [
          { setNumber: 1, completed: true },
          { setNumber: 2, completed: true },
          { setNumber: 3, completed: false },
        ],
      };

      const completedCount = draft.setLogs.filter((s) => s.completed).length;
      expect(completedCount).toBe(2);
      expect(draft.setLogs.length).toBe(3);
    });
  });
});
