import react from "@vitejs/plugin-react";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { errorMessage, parseJson } from "../shared/validate/json.ts";
import { formatLayout } from "../shared/layout/format.ts";
import { parseMapLayout } from "../shared/layout/schema.ts";

const root = fileURLToPath(new URL(".", import.meta.url));
const webPublic = path.resolve(root, "../web/public");
const layoutsDir = path.join(webPublic, "layouts");
const src = path.join(root, "src");
const shared = path.resolve(root, "../shared");

const MAP_FILE = /^de_[a-z0-9]+\.json$/;
const MAX_BODY_BYTES = 1_000_000;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: string) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(body);
}

/** Dev-only: write layout JSON into apps/web/public/layouts/. Not deployed. */
function writeLayoutPlugin(): Plugin {
  return {
    name: "write-layout-json",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (req.method !== "PUT" || !url.startsWith("/__write/layouts/")) {
          next();
          return;
        }
        const file = url.slice("/__write/layouts/".length);
        if (!MAP_FILE.test(file)) {
          send(res, 400, JSON.stringify({ error: "map file must look like de_dust2.json" }));
          return;
        }
        const map = file.slice(0, -".json".length);
        try {
          const parsed = parseJson(await readBody(req as IncomingMessage));
          const layout = parseMapLayout(parsed, map);
          if (!layout) {
            send(res, 400, JSON.stringify({ error: "invalid layout JSON" }));
            return;
          }
          layout.map = map;
          await mkdir(layoutsDir, { recursive: true });
          await writeFile(path.join(layoutsDir, file), formatLayout(layout), "utf8");
          send(res, 200, JSON.stringify({ ok: true, path: `apps/web/public/layouts/${file}` }));
        } catch (err: unknown) {
          send(res, 400, JSON.stringify({ error: errorMessage(err) || "save failed" }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), writeLayoutPlugin()],
  resolve: {
    alias: {
      "@": src,
      "@shared": shared,
    },
  },
  publicDir: webPublic,
  server: {
    port: 5174,
    fs: {
      allow: [root, webPublic],
    },
  },
  test: {
    reporters: process.env.CI ? ["verbose"] : ["default"],
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
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/main.tsx",
        "src/lib/testing/**",
        "src/lib/types.ts",
        "src/vite-env.d.ts",
      ],
      reporter: ["text", "html", "lcov"],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 90,
      },
    },
  },
});
