import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// .mts: proje CommonJS olduğu için ESM yapılandırma ayrı uzantıda (Vite'ın yerel config yükleyicisi
// .ts'i CommonJS sayar). __dirname yerine import.meta.url.

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Testlerde JSX React 19 otomatik runtime ile derlenir (Next 16 tsconfig'i de "react-jsx" yapar).
  // Vite 8 dönüşümleri esbuild yerine Oxc ile yapar.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/generated/**"],
      reporter: ["text-summary", "html", "json-summary"],
      reportsDirectory: "coverage",
      // Taban çizgisi: kapsam bunun altına düşerse test başarısız olur. Yalnız yukarı çekilir.
      thresholds: { lines: 89, statements: 88, branches: 76, functions: 86 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/ui/**"],
          // Şablon DB bir kez kurulur; her test dosyası kendi kopyasında çalışır.
          globalSetup: ["tests/setup/global-db.ts"],
          setupFiles: ["tests/setup/per-file-db.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["tests/ui/**/*.test.{ts,tsx}"],
          setupFiles: ["tests/setup/ui.ts"],
        },
      },
    ],
  },
});
