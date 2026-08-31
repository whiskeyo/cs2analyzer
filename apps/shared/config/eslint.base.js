/**
 * Shared ESLint rules for apps/web and apps/layouts.
 * Import into each app's eslint.config.js flat config.
 */

/** @type {import("eslint").Linter.RulesRecord} */
export const sharedRules = {
  curly: ["error", "all"],
  "@typescript-eslint/no-explicit-any": "error",
};
