import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";
import { sharedRules } from "./config/eslint.base.js";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "src/parser/**",
      "src/lib/tutorial/header.ts",
      "src/lib/tutorial/players.ts",
      "src/lib/tutorial/rounds.ts",
      "src/lib/tutorial/events.ts",
      "src/lib/tutorial/ticks.ts",
      "src/lib/tutorial/ticks_*.ts",
      "src/lib/tutorial/series/manifest.ts",
      "src/lib/tutorial/series/loaders.ts",
      "src/lib/tutorial/series/matches/**/header.ts",
      "src/lib/tutorial/series/matches/**/players.ts",
      "src/lib/tutorial/series/matches/**/rounds.ts",
      "src/lib/tutorial/series/matches/**/events.ts",
      "src/lib/tutorial/series/matches/**/ticks.ts",
      "src/lib/tutorial/series/matches/**/ticks_*.ts",
      "src/lib/tutorial/series/matches/**/payload.ts",
      "*.tsbuildinfo",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Canvas/playback loops keep latest props in refs; that is intentional.
      "react-hooks/refs": "off",
      // Layout/radar pointer hooks mutate view refs (same as former layouts app).
      "react-hooks/immutability": "off",
      "react-refresh/only-export-components": "off",
      ...sharedRules,
    },
  },
  prettier,
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "max-lines": ["warn", { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}"],
    ignores: [
      "src/components/radar/**",
      "src/components/playbook/PlaybookCanvas.tsx",
      "src/components/layouts/LayoutCanvas.tsx",
    ],
    rules: {
      "react-hooks/immutability": "error",
    },
  },
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    ignores: ["src/parser/**"],
    rules: {
      "max-lines": ["warn", { max: 600, skipBlankLines: true, skipComments: true }],
    },
  },
);
