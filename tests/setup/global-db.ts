import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import type { TestProject } from "vitest/node";
import { runMigrations } from "../../src/lib/db/migrate";

declare module "vitest" {
  export interface ProvidedContext {
    templateDb: string;
  }
}

/**
 * Boş şablon veritabanını GERÇEK migration dosyalarıyla kurar (uygulamanın açılışta yaptığı gibi).
 * Böylece her test koşusu migration'ların şemayla uyumlu olduğunu da doğrular.
 * Her test dosyası bunun bir kopyasını alır (tests/setup/per-file-db.ts).
 */
export default async function setup(project: TestProject) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rutinfit-template-"));
  const templateDb = path.join(dir, "template.db");
  const client = new PrismaClient({ datasourceUrl: `file:${templateDb}` });
  await runMigrations(client, { migrationsDir: path.resolve(__dirname, "../../prisma/migrations") });
  await client.$disconnect();

  project.provide("templateDb", templateDb);

  return () => {
    fs.rmSync(dir, { recursive: true, force: true });
  };
}
