import { normalizePath } from "./routes";

/** Stamped on `#root` so the client can tell which path the HTML was rendered for. */
export const PRERENDER_PATH_ATTR = "data-prerender-path";

/** Path rendered into `dist/404.html`. ErrorDocument serves that file for other URLs. */
export const NOT_FOUND_PRERENDER_PATH = "/404";

export type HydrateAction = "hydrate" | "redirect" | "render";

/** True when this document's prerender path is the URL we are on (slash-insensitive). */
export function shouldHydratePrerender(renderedPath: string | null, locationPath: string): boolean {
  if (renderedPath == null || renderedPath === "") return false;
  return normalizePath(renderedPath) === normalizePath(locationPath);
}

/**
 * SPA fallback serves home `index.html` for `/tutorial` and `/analyzer`.
 * Hydrating that stamped document is React #418. A no-slash URL can still load
 * the prerendered `…/index.html` after a trailing-slash redirect; otherwise
 * render the route on the client.
 *
 * An unstamped document hydrates (Apache already served the matching file).
 * `404.html` is stamped `/404` and must hydrate on the unknown URL that
 * triggered ErrorDocument.
 */
export function hydrateAction(
  renderedPath: string | null,
  locationPath: string,
  hasChildren: boolean,
): HydrateAction {
  if (!hasChildren) return "render";
  if (renderedPath == null || renderedPath === "") return "hydrate";
  if (normalizePath(renderedPath) === NOT_FOUND_PRERENDER_PATH) return "hydrate";
  if (shouldHydratePrerender(renderedPath, locationPath)) return "hydrate";
  if (locationPath.length > 1 && !locationPath.endsWith("/")) return "redirect";
  return "render";
}

/** Path half of the trailing-slash redirect. Search and hash stay on `location`. */
export function prerenderRedirectPath(locationPath: string): string {
  return `${normalizePath(locationPath)}/`;
}
