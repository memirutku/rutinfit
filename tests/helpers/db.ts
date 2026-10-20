import { prisma } from "@/lib/prisma";

let cachedTables: string[] | null = null;

async function userTables(): Promise<string[]> {
  if (!cachedTables) {
    const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' AND name NOT LIKE '_rutinfit_%'"
    );
    cachedTables = rows.map((r) => r.name);
  }
  return cachedTables;
}

/**
 * Test dosyasının kendi veritabanındaki tüm tabloları boşaltır.
 * Yabancı anahtar kontrolleri commit anına ertelenir, böylece silme sırası önemsizdir.
 */
export async function resetDatabase(): Promise<void> {
  const tables = await userTables();
  await prisma.$transaction([
    prisma.$executeRawUnsafe("PRAGMA defer_foreign_keys = ON"),
    ...tables.map((t) => prisma.$executeRawUnsafe(`DELETE FROM "${t}"`)),
  ]);
}
