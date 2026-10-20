import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "src-tauri/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "opengym/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "react/no-unescaped-entities": "off",
      // Mevcut kod tabanı `any`'ye dayanıyor; kademeli olarak daraltılacak.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },
  {
    // İstemci kodu tipleri src/lib/schemas'tan alır; burada `any` artık yasak.
    files: ["src/app/**/page.tsx", "src/components/**/*.{ts,tsx}", "src/hooks/**/*.ts", "src/lib/client/**/*.ts", "src/lib/schemas/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
  {
    // Playwright fikstürlerindeki `use()` bir React hook'u değildir.
    files: ["e2e/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
];

export default config;
