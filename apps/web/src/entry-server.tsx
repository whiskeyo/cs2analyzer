import { renderToString } from "react-dom/server";
import { renderApp } from "@/lib/app/renderApp";

export { injectPrerenderedPage, PRERENDER_PATHS, prerenderFilePath } from "@/lib/app/prerender";

/** Build-time HTML for one public route. Loaded via Vite `ssrLoadModule`, not the client bundle. */
export function render(url: string): string {
  return renderToString(renderApp(url));
}
