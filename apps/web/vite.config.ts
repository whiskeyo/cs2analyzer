import path from "node:path";
import react from "@vitejs/plugin-react";
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));
const src = fileURLToPath(new URL("./src", import.meta.url));
const shared = path.resolve(root, "../shared");

/** Vite's public copy can skip dotfiles; Apache on OVH still needs this name. */
function copyHtaccess() {
  return {
    name: "copy-htaccess",
    closeBundle() {
      const from = `${root}public/.htaccess`;
      const to = `${root}dist/.htaccess`;
      if (existsSync(from)) copyFileSync(from, to);
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react(), copyHtaccess()],
  resolve: {
    alias: {
      "@": src,
      "@shared": shared,
    },
  },
  worker: {
    format: "es",
  },
  test: {
    // `.test.ts` is pure logic and stays on the fast node path;
    // `.test.tsx` renders components and needs a DOM.
    projects: [
      {
        extends: true,
        test: {
          name: "logic",
          environment: "node",
          include: ["src/**/*.test.ts", "../shared/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["src/lib/testing/setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/parser/**", "src/lib/testing/**", "src/**/*.test.{ts,tsx}", "src/main.tsx"],
    },
  },
});
