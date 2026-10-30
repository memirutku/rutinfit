/**
 * Dalga 5 persona testleri: PAKETLENMİŞ masaüstü sunucusu (src-tauri/.../RutinFit.app içindeki
 * gömülü Node + server) her persona için ayrı, boş bir veri klasörüyle başlatılır. Seed yoktur:
 * personalar gerçek bir ilk kurulumdan başlar. Dış servisler (yerel model, Open Food Facts) sahtedir.
 */
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startMockServices } from "../support/mock-services";

const root = path.resolve(__dirname, "../..");
const APP = path.join(root, "src-tauri/target/release/bundle/macos/RutinFit.app/Contents");
const MOCK_PORT = Number(process.env.PERSONA_MOCK_PORT ?? 3300);
const BASE_PORT = Number(process.env.PERSONA_BASE_PORT ?? 3301);
export const PERSONAS = ["ayse", "mert", "zeynep", "emre", "can", "elif"] as const;

async function waitHealthy(port: number) {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return;
    } catch {
      // henüz açılmadı
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Persona sunucusu açılmadı: ${port}`);
}

async function main() {
  if (!fs.existsSync(path.join(APP, "Resources/server/desktop-entry.cjs"))) {
    throw new Error("Önce `pnpm desktop:build` çalıştırın (RutinFit.app bulunamadı).");
  }
  const mocks = await startMockServices(MOCK_PORT);
  const children: ChildProcess[] = [];
  const dirs: string[] = [];
  for (const [i, name] of PERSONAS.entries()) {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), `rutinfit-persona-${name}-`));
    dirs.push(dataDir);
    const child = spawn(path.join(APP, "MacOS/node"), ["desktop-entry.cjs"], {
      cwd: path.join(APP, "Resources/server"),
      stdio: ["ignore", "ignore", "inherit"],
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        PORT: String(BASE_PORT + i),
        HOSTNAME: "127.0.0.1",
        RUTINFIT_DATA_DIR: dataDir,
        OPENFOODFACTS_BASE_URL: mocks.offBaseUrl,
        OPENGYM_BASE_URL: "http://127.0.0.1:9",
      } as NodeJS.ProcessEnv,
    });
    children.push(child);
  }
  await Promise.all(PERSONAS.map((_, i) => waitHealthy(BASE_PORT + i)));
  console.log(`[persona] ${PERSONAS.length} sunucu hazır (${BASE_PORT}–${BASE_PORT + PERSONAS.length - 1}), sahte model ${mocks.llmBaseUrl}`);

  const shutdown = async () => {
    for (const c of children) c.kill("SIGTERM");
    await mocks.close();
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
