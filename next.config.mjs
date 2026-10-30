import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Masaüstü paketi: node_modules ve proje klasörü olmadan çalışan bağımsız sunucu (.next/standalone)
  output: "standalone",
  // Kök sabit: üst klasörde başka bir lockfile olsa bile (ör. git worktree) Next kökü yanlış
  // tahmin edip server.js'i .next/standalone/<alt/yol>/ altına koymasın.
  outputFileTracingRoot: projectRoot,
  // pdf-parse (içinde pdfjs) derleyiciyle sunucu parçasına gömülürse yanındaki dosyaları
  // bulamaz: `@napi-rs/canvas`'ı `createRequire(__filename)` ile, `./pdf.worker.mjs`'i kendi
  // klasörüne göreli yükler. Dış paket olarak node_modules'tan, düz Node'daki gibi çalışır.
  serverExternalPackages: ["pdf-parse"],
  outputFileTracingIncludes: {
    // Açılışta uygulanan migration dosyaları sunucuyla birlikte paketlenir.
    "/*": ["./prisma/migrations/**/*"],
    // pdf-parse'ın dinamik yüklediği, dosya izleyicinin göremediği parçalar. canvas yoksa
    // modül yüklenirken "DOMMatrix is not defined" atar ve PDF'den metin çıkmaz.
    "/api/files/upload": [
      "./node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs",
      // Platforma özgü yerel eklenti paketi (ör. @napi-rs/canvas-darwin-arm64) dahil.
      "./node_modules/@napi-rs/canvas*/**/*",
    ],
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
  // Turbopack (Next 16'da dev ve build için varsayılan) aynı kökü kullanır.
  turbopack: { root: projectRoot },
  allowedDevOrigins: ["127.0.0.1", "127.0.0.1:3005", "localhost", "localhost:3005"],
  // `next dev`, bir yapay zekâ ajanı algılayınca depoya AGENTS.md yazar; depoda üretilen dosya
  // istenmiyor. Sürüme uygun belgeler: node_modules/next/dist/docs/
  agentRules: false,
};

export default nextConfig;
