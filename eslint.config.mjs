import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16 doğrudan flat config verir (FlatCompat / @eslint/eslintrc gerekmez).
const config = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "src-tauri/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "opengym/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
  {
    // eslint-config-next eklentileri yalnız bu uzantılar için kaydeder (.cjs hariç).
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      "react/no-unescaped-entities": "off",
      // Mevcut kod tabanı `any`'ye dayanıyor; kademeli olarak daraltılacak.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // eslint-plugin-react-hooks 7 (eslint-config-next 16) React Compiler kurallarını getirdi.
      // Uygulama React Compiler kullanmıyor; işaretlenen kalıplar (son-değer ref'i, effect içinde
      // localStorage'dan ilk değer, sayaçta Date.now) çalışıyor. Davranış değiştirmemek için
      // yükseltmede uyarıya çekildi; ayrı bir işte düzeltilip yeniden "error" yapılacak.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
  {
    // Playwright fikstürlerindeki `use()` bir React hook'u değildir.
    files: ["e2e/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
]);

export default config;
