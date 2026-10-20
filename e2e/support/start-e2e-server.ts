/**
 * Playwright webServer giriş noktası: geçici veri klasörü + şema + seed + sahte servisler
 * + `next start`. Gerçek kullanıcı veritabanına hiçbir şekilde dokunmaz.
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { startMockServices } from "./mock-services";

const root = path.resolve(__dirname, "../..");
const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3105);
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT ?? 3106);
const bin = (name: string) => path.join(root, "node_modules", ".bin", name);

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "rutinfit-e2e-"));
  const dbUrl = `file:${path.join(dataDir, "rutinfit.db")}`;
  const env = { ...process.env, DATABASE_URL: dbUrl };

  // seed önce migration'ları uygular (uygulamanın açılışta yaptığıyla aynı yol)
  execFileSync(bin("tsx"), ["prisma/seed.ts"], { cwd: root, env, stdio: "inherit" });

  const mocks = await startMockServices(MOCK_PORT);
  const prisma = new PrismaClient({ datasourceUrl: dbUrl });
  await prisma.aISettings.upsert({
    where: { id: "default-ai" },
    update: { baseUrl: mocks.llmBaseUrl, modelName: "mock-llama", providerType: "ollama", connectionStatus: "connected" },
    create: { id: "default-ai", baseUrl: mocks.llmBaseUrl, modelName: "mock-llama", providerType: "ollama", connectionStatus: "connected" },
  });
  await prisma.$disconnect();

  // Masaüstü paketiyle aynı sunucu: .next/standalone (statik dosyalar elle kopyalanır).
  const standalone = path.join(root, ".next", "standalone");
  if (!fs.existsSync(path.join(standalone, "server.js"))) {
    throw new Error("Önce `pnpm build` çalıştırın (.next/standalone bulunamadı).");
  }
  fs.cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });

  const app = spawn(process.execPath, ["server.js"], {
    cwd: standalone,
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: String(APP_PORT),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      RUTINFIT_DATA_DIR: dataDir,
      OPENFOODFACTS_BASE_URL: mocks.offBaseUrl,
      OPENGYM_BASE_URL: "http://127.0.0.1:9",
      DATABASE_URL: undefined,
    } as NodeJS.ProcessEnv,
  });

  const shutdown = async () => {
    app.kill("SIGTERM");
    await mocks.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  app.on("exit", (code) => {
    if (code && code !== 0) process.exit(code);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
