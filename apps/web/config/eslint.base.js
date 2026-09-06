/**
 * Shared ESLint rules for the web app.
 * Import into each app's eslint.config.js flat config.
 */

/** @type {import("eslint").Linter.RulesRecord} */
export const sharedRules = {
  curly: ["error", "all"],
  "@typescript-eslint/no-explicit-any": "error",
};
