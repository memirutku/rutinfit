import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { normalizeName } from "@/lib/text";
import type { LastSetsResponse } from "@/lib/schemas/workout";

/**
 * B17: Seans formunu önceki seansın ağırlıklarıyla doldurmak için, istenen her egzersizin
 * son tamamlanmış seanstaki çalışma setleri (ısınma hariç). Ad eşleşmesi büyük/küçük harf
 * ve boşluk duyarsızdır. GET /api/workouts/last-sets?exercise=Bench%20Press&exercise=Squat
 */
export async function GET(req: Request) {
  try {
    const requested = [...new Set(new URL(req.url).searchParams.getAll("exercise").map((e) => e.trim()).filter(Boolean))];
    const result: LastSetsResponse = {};
    if (requested.length === 0) return NextResponse.json(result);

    const wanted = new Map(requested.map((name) => [normalizeName(name), name]));
    const rows = await prisma.setLog.findMany({
      where: { session: { completed: true }, setType: { not: "warmup" }, reps: { gt: 0 } },
      select: { exerciseName: true, weightKg: true, reps: true, setNumber: true, session: { select: { id: true, date: true, createdAt: true } } },
      orderBy: [{ session: { date: "desc" } }, { session: { createdAt: "desc" } }, { setNumber: "asc" }],
    });

    // Satırlar en yeni seanstan eskiye sıralı: her egzersiz için ilk görülen seans "son" seanstır.
    const sessionFor = new Map<string, string>();
    for (const row of rows) {
      const name = wanted.get(normalizeName(row.exerciseName));
      if (!name) continue;
      const sessionId = sessionFor.get(name) ?? row.session.id;
      sessionFor.set(name, sessionId);
      if (row.session.id !== sessionId) continue;
      (result[name] ??= { date: row.session.date, sets: [] }).sets.push({ weightKg: row.weightKg, reps: row.reps });
    }
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, "Önceki setler getirilemedi", "Workouts last-sets GET");
  }
}
