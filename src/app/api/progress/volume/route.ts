import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { addDaysToDateString, getLocalDateString, startOfWeek } from "@/lib/date-utils";
import { muscleGroupsWithLibrary } from "@/lib/exercise-library";
import { loadExerciseLibrary } from "@/lib/services/exercises";
import { VOLUME_TARGET, weeklyMuscleSets } from "@/lib/muscle-volume";

/** F24: Son N haftanın (varsayılan 4, en çok 12) kas grubu başına set sayısı. */
export async function GET(req: Request) {
  try {
    const weeks = Math.min(12, Math.max(1, Number(new URL(req.url).searchParams.get("weeks")) || 4));
    const today = getLocalDateString();
    const from = addDaysToDateString(startOfWeek(today), -7 * (weeks - 1));
    const sessions = await prisma.workoutSession.findMany({
      where: { completed: true, date: { gte: from, lte: today } },
      select: { date: true, completed: true, setLogs: { select: { exerciseName: true } } },
    });
    const groups = muscleGroupsWithLibrary(await loadExerciseLibrary());
    return NextResponse.json({ ...weeklyMuscleSets(sessions, groups, today, weeks), target: VOLUME_TARGET });
  } catch (error) {
    return apiError(error, "Haftalık hacim getirilemedi", "Volume GET");
  }
}
