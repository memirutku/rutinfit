import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, inject } from "vitest";

// Her test dosyası için ayrı veri klasörü ve şablondan kopyalanmış boş veritabanı.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "rutinfit-test-"));
fs.copyFileSync(inject("templateDb"), path.join(dataDir, "rutinfit.db"));
process.env.RUTINFIT_DATA_DIR = dataDir;
delete process.env.DATABASE_URL;

// Testler gerçek internete veya yerel servislere çıkmasın: kapalı bir porta yönlendir.
process.env.OPENFOODFACTS_BASE_URL ??= "http://127.0.0.1:9";
process.env.OPENGYM_BASE_URL ??= "http://127.0.0.1:9";

afterAll(async () => {
  const g = globalThis as { prisma?: { $disconnect: () => Promise<void> } };
  if (g.prisma) {
    await g.prisma.$disconnect();
    delete g.prisma;
  }
  fs.rmSync(dataDir, { recursive: true, force: true });
});
