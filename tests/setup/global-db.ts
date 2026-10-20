import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    templateDb: string;
  }
}

/**
 * Şemadan boş bir şablon SQLite veritabanı kurar.
 * Her test dosyası bunun bir kopyasını alır (tests/setup/per-file-db.ts),
 * böylece testler birbirini ve geliştirici veritabanını etkilemez.
 */
export default function setup(project: TestProject) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rutinfit-template-"));
  const templateDb = path.join(dir, "template.db");
  const prismaBin = path.resolve(__dirname, "../../node_modules/.bin/prisma");

  execFileSync(prismaBin, ["db", "push", "--skip-generate"], {
    env: { ...process.env, DATABASE_URL: `file:${templateDb}` },
    stdio: "pipe",
  });

  project.provide("templateDb", templateDb);

  return () => {
    fs.rmSync(dir, { recursive: true, force: true });
  };
}
