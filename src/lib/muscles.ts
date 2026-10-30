/**
 * Kas grupları ve onları çalıştıran egzersizler. Isı haritası (son 7 gün) ve haftalık set
 * hacmi (F24) aynı tanımları kullanır. Egzersiz adı eşleşmesi yazım farklarına toleranslıdır
 * (bkz. exerciseMatches).
 */
export interface MuscleGroup {
  muscleId: string;
  nameTr: string;
  nameLatin: string;
  side: "front" | "back";
  category: "push" | "pull" | "legs" | "core";
  exercises: string[];
}

export const MUSCLE_GROUPS: MuscleGroup[] = [
  // ÖN VÜCUT
  {
    muscleId: "chest",
    nameTr: "Göğüs (Pektoralis)",
    nameLatin: "Pectoralis Major & Minor",
    side: "front",
    category: "push",
    exercises: ["Bench Press", "Dumbbell Press", "Pushup", "Incline Dumbbell Press"],
  },
  {
    muscleId: "front_delts",
    nameTr: "Ön Omuz",
    nameLatin: "Anterior Deltoid",
    side: "front",
    category: "push",
    exercises: ["Overhead Press", "Incline Press", "Front Raise"],
  },
  {
    muscleId: "side_delts",
    nameTr: "Yan Omuz",
    nameLatin: "Lateral Deltoid",
    side: "front",
    category: "push",
    exercises: ["Lateral Raise", "Upright Row"],
  },
  {
    muscleId: "biceps",
    nameTr: "Pazı (Biceps)",
    nameLatin: "Biceps Brachii",
    side: "front",
    category: "pull",
    exercises: ["Bicep Curl", "Hammer Curl", "Chin-up"],
  },
  {
    muscleId: "forearms",
    nameTr: "Ön Kol",
    nameLatin: "Brachioradialis",
    side: "front",
    category: "pull",
    exercises: ["Deadlift", "Farmer's Walk", "Wrist Curl"],
  },
  {
    muscleId: "abs",
    nameTr: "Karın (Core)",
    nameLatin: "Rectus Abdominis",
    side: "front",
    category: "core",
    exercises: ["Plank", "Cable Crunch", "Hanging Leg Raise"],
  },
  {
    muscleId: "obliques",
    nameTr: "Yan Karın",
    nameLatin: "External Obliques",
    side: "front",
    category: "core",
    exercises: ["Side Plank", "Russian Twist"],
  },
  {
    muscleId: "quads",
    nameTr: "Ön Bacak (Quadriceps)",
    nameLatin: "Quadriceps Femoris",
    side: "front",
    category: "legs",
    exercises: ["Squat", "Leg Press", "Bulgarian Split Squat", "Leg Extension"],
  },
  {
    muscleId: "calves_front",
    nameTr: "Kaval & Alt Bacak",
    nameLatin: "Tibialis Anterior",
    side: "front",
    category: "legs",
    exercises: ["Calf Raise", "Tibialis Raise"],
  },

  // ARKA VÜCUT
  {
    muscleId: "traps",
    nameTr: "Trapez & Boyun",
    nameLatin: "Trapezius (Upper & Mid)",
    side: "back",
    category: "pull",
    exercises: ["Shrug", "Deadlift", "Face Pull"],
  },
  {
    muscleId: "rear_delts",
    nameTr: "Arka Omuz",
    nameLatin: "Posterior Deltoid",
    side: "back",
    category: "pull",
    exercises: ["Face Pull", "Rear Delt Fly", "Barbell Row"],
  },
  {
    muscleId: "lats",
    nameTr: "Sırt & Kanat",
    nameLatin: "Latissimus Dorsi",
    side: "back",
    category: "pull",
    exercises: ["Lat Pulldown", "Barbell Row", "Seated Cable Row", "Pull-up"],
  },
  {
    muscleId: "lower_back",
    nameTr: "Bel & Erektör",
    nameLatin: "Erector Spinae",
    side: "back",
    category: "pull",
    exercises: ["RDL (Romanian Deadlift)", "Deadlift", "Back Extension"],
  },
  {
    muscleId: "triceps",
    nameTr: "Arka Kol (Triceps)",
    nameLatin: "Triceps Brachii",
    side: "back",
    category: "push",
    exercises: ["Tricep Pushdown", "Skull Crusher", "Dips", "Close Grip Bench"],
  },
  {
    muscleId: "glutes",
    nameTr: "Kalça (Glute)",
    nameLatin: "Gluteus Maximus & Medius",
    side: "back",
    category: "legs",
    exercises: ["Squat", "Hip Thrust", "RDL", "Lunge"],
  },
  {
    muscleId: "hamstrings",
    nameTr: "Arka Bacak (Hamstring)",
    nameLatin: "Biceps Femoris & Semitendinosus",
    side: "back",
    category: "legs",
    exercises: ["RDL", "Leg Curl", "Stiff-Leg Deadlift"],
  },
  {
    muscleId: "calves_back",
    nameTr: "Baldır (Calf)",
    nameLatin: "Gastrocnemius & Soleus",
    side: "back",
    category: "legs",
    exercises: ["Standing Calf Raise", "Seated Calf Raise"],
  },
];
