import { normalizePath } from "./routes";

/** Stamped on `#root` so the client can tell which path the HTML was rendered for. */
export const PRERENDER_PATH_ATTR = "data-prerender-path";

export type HydrateAction = "hydrate" | "redirect" | "render";

/** True when this document's prerender path is the URL we are on (slash-insensitive). */
export function shouldHydratePrerender(renderedPath: string | null, locationPath: string): boolean {
  if (renderedPath == null || renderedPath === "") return false;
  return normalizePath(renderedPath) === normalizePath(locationPath);
}

/**
 * SPA fallback serves home `index.html` for `/tutorial` and `/analyzer`.
 * Hydrating that document is React #418. A no-slash URL can still load the
 * prerendered `…/index.html` after a trailing-slash redirect; otherwise
 * render the route on the client.
 */
export function hydrateAction(
  renderedPath: string | null,
  locationPath: string,
  hasChildren: boolean,
): HydrateAction {
  if (!hasChildren) return "render";
  if (shouldHydratePrerender(renderedPath, locationPath)) return "hydrate";
  if (locationPath.length > 1 && !locationPath.endsWith("/")) return "redirect";
  return "render";
}

/** Path half of the trailing-slash redirect. Search and hash stay on `location`. */
export function prerenderRedirectPath(locationPath: string): string {
  return `${normalizePath(locationPath)}/`;
}
