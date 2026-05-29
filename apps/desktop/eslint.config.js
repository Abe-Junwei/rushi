import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "src-tauri/target"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["vite.config.ts", "vitest.config.ts", "playwright.config.ts", "tests/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
      parser: tseslint.parser,
    },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // 防止浮空 Promise
      "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: true }],
      // 防止 Promise 误用
      "@typescript-eslint/no-misused-promises": "error",
      // 生产代码不留 console.log
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // `_` 前缀表示「有意未使用」（占位参数、稳定签名）
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // vitest mock spies (vi.fn) are object methods, so referencing them in
    // `expect(ctx.fillRect)` trips unbound-method — a known false positive for
    // mocking libraries. Relax it for test files only.
    files: ["src/**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/unbound-method": "off",
    },
  },
);
