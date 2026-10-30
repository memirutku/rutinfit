/** F25: Yerleşik kütüphane + kullanıcının özel egzersizleri. */
import { prisma } from "../prisma";
import { EXERCISE_LIBRARY, type Equipment, type LibraryExercise } from "../exercise-library";

const parseList = (raw: string): string[] => {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export async function loadExerciseLibrary(): Promise<LibraryExercise[]> {
  const custom = await prisma.customExercise.findMany();
  return [
    ...EXERCISE_LIBRARY,
    ...custom.map((c) => ({
      id: c.id,
      name: c.name,
      nameTr: c.nameTr || c.name,
      primary: c.primary,
      secondary: parseList(c.secondary),
      equipment: c.equipment as Equipment,
      cues: parseList(c.cues),
      isCustom: true,
    })),
  ];
}
