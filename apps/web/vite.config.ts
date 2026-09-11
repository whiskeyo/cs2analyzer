import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { FAQ_HEADING_OFFSET, parseFaqMarkdown } from "./src/lib/app/faqParse.ts";
import { compileMarkdown } from "./src/lib/markdown/compile.ts";
import { errorMessage, parseJson } from "./src/lib/validate/json.ts";
import { formatLayout } from "./src/lib/layout/format.ts";
import { parseMapLayout } from "./src/lib/layout/schema.ts";

const root = fileURLToPath(new URL(".", import.meta.url));
const src = fileURLToPath(new URL("./src", import.meta.url));

const layoutsDir = path.join(root, "public", "layouts");
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

/** Compile `content/faq/*.md` to `{ question, html }` so the client does not ship remark. */
function faqMarkdownPlugin(): Plugin {
  return {
    name: "faq-markdown",
    enforce: "pre",
    transform(code, id) {
      const file = (id.split("?")[0] ?? id).replaceAll("\\", "/");
      if (!file.endsWith(".md") || !file.includes("/content/faq/")) {
        return;
      }
      if (id.includes("?raw")) {
        return;
      }
      const { question, markdown } = parseFaqMarkdown(code, file);
      const html = compileMarkdown(markdown, FAQ_HEADING_OFFSET);
      const article = { question, html };
      return {
        code: `const article = ${JSON.stringify(article)};
export const question = article.question;
export const html = article.html;
export default article;`,
        map: null,
      };
    },
  };
}

/** Dev-only: write layout JSON into public/layouts/. Not deployed. */
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

function gitShortHash(): string {
  try {
    return execSync("git rev-parse --short HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "dev";
  }
}

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

const SPA_ROUTES = ["analyzer", "playbook", "faq", "layouts"] as const;

/** Duplicate index.html so /playbook and /faq resolve without a rewrite (OVH 404). */
function spaFallbackPages() {
  return {
    name: "spa-fallback-pages",
    closeBundle() {
      const index = `${root}dist/index.html`;
      if (!existsSync(index)) return;
      const html = readFileSync(index);
      writeFileSync(`${root}dist/404.html`, html);
      for (const route of SPA_ROUTES) {
        const dir = `${root}dist/${route}`;
        mkdirSync(dir, { recursive: true });
        writeFileSync(`${dir}/index.html`, html);
      }
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE || "/",
  define: {
    __APP_VERSION__: JSON.stringify(gitShortHash()),
  },
  plugins: [react(), faqMarkdownPlugin(), copyHtaccess(), spaFallbackPages(), writeLayoutPlugin()],
  resolve: {
    alias: {
      "@": src,
    },
  },
  worker: {
    format: "es",
  },
  test: {
    // Compact locally; print the describe/it tree on CI (GitHub sets CI=true).
    reporters: process.env.CI ? ["verbose"] : ["default"],
    // `.test.ts` is pure logic and stays on the fast node path;
    // `.test.tsx` renders components and needs a DOM.
    projects: [
      {
        extends: true,
        test: {
          name: "logic",
          environment: "node",
          include: ["src/**/*.test.ts"],
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
      reporter: ["text", "html", "lcov"],
    },
  },
});
