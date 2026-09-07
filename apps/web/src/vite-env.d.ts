/// <reference types="vite/client" />

/** Short git commit hash baked in at build time, or `"dev"`. */
declare const __APP_VERSION__: string;

declare module "*.md?raw" {
  const markdown: string;
  export default markdown;
}
