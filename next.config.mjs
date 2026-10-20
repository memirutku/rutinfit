import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Masaüstü paketi: node_modules ve proje klasörü olmadan çalışan bağımsız sunucu (.next/standalone)
  output: "standalone",
  // İzleme kökü proje klasörüdür. Aksi halde üst klasörde başka bir kilit dosyası varsa
  // (ör. iç içe git worktree) Next kökü yanlış tahmin eder ve server.js alt klasöre düşer.
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  // Açılışta uygulanan migration dosyaları sunucuyla birlikte paketlenir.
  outputFileTracingIncludes: {
    "/*": ["./prisma/migrations/**/*"],
  },
  // Kod process.cwd() altındaki veri klasörlerine dokunduğu için dosya izleyici onları da
  // pakete katıyordu (yedekler, dev.db, openGym anahtarları, yüklemeler). Kullanıcı verisi
  // asla pakete girmez; scripts/prepare-desktop.mjs ayrıca doğrular.
  outputFileTracingExcludes: {
    "/*": [
      "./backups/**/*",
      "./uploads/**/*",
      "./opengym/**/*",
      "./prisma/*.db",
      "./prisma/*.db-journal",
      "./prisma/*.bak",
      "./prisma/seed.ts",
      "./coverage/**/*",
      "./test-results/**/*",
      "./src-tauri/**/*",
    ],
  },
  allowedDevOrigins: ["127.0.0.1", "127.0.0.1:3005", "localhost", "localhost:3005"],
  webpack: (config, { dev }) => {
    if (dev) {
      config.output = config.output || {};
      config.output.chunkLoadTimeout = 60000;
    }
    return config;
  },
};

export default nextConfig;
