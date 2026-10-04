export const ROUTES = {
  home: "/",
  analyzer: "/analyzer",
  tutorial: "/tutorial",
  playbook: "/playbook",
  faq: "/faq",
  rating: "/rating",
  contact: "/contact",
  layouts: "/layouts",
} as const;

export function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname || ROUTES.home;
}

/**
 * Address-bar form of a pathname. Prerendered routes and canonicals are slashless;
 * Apache also serves the slash form as 200, and the client collapses it before hydrate.
 */
export function canonicalLocation(pathname: string, search = "", hash = ""): string {
  return `${normalizePath(pathname)}${search}${hash}`;
}

export function isHomePath(pathname: string): boolean {
  return normalizePath(pathname) === ROUTES.home;
}

export function isAnalyzerPath(pathname: string): boolean {
  return normalizePath(pathname) === ROUTES.analyzer;
}

export function isPlaybookPath(pathname: string): boolean {
  return normalizePath(pathname) === ROUTES.playbook;
}

export function isFaqPath(pathname: string): boolean {
  return normalizePath(pathname) === ROUTES.faq;
}

export function isRatingPath(pathname: string): boolean {
  return normalizePath(pathname) === ROUTES.rating;
}

export function isContactPath(pathname: string): boolean {
  return normalizePath(pathname) === ROUTES.contact;
}

export function isLayoutsPath(pathname: string): boolean {
  return normalizePath(pathname) === ROUTES.layouts;
}
