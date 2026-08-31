import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";
import { sharedRules } from "../shared/config/eslint.base.js";

export default tseslint.config(
  {
    ignores: ["dist/**", "src/parser/**", "*.tsbuildinfo"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}", "../shared/**/*.ts"],
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
    files: ["src/lib/**/*.{ts,tsx}"],
    ignores: ["src/parser/**"],
    rules: {
      "max-lines": ["warn", { max: 600, skipBlankLines: true, skipComments: true }],
    },
  },
);
