import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // tsconfig "jsx: preserve" Next.js içindir; testlerde JSX'i React 19 otomatik runtime ile derle.
  esbuild: { jsx: "automatic" },
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts"],
      reporter: ["text-summary", "html", "json-summary"],
      reportsDirectory: "coverage",
      // Taban çizgisi: kapsam bunun altına düşerse test başarısız olur. Yalnız yukarı çekilir.
      thresholds: { lines: 49, statements: 49, branches: 38, functions: 36 },
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
