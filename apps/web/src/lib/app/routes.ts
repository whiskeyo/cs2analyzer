export const ROUTES = {
  home: "/",
  analyzer: "/analyzer",
  playbook: "/playbook",
  faq: "/faq",
  contact: "/contact",
  layouts: "/layouts",
} as const;

export function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname || ROUTES.home;
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

export function isContactPath(pathname: string): boolean {
  return normalizePath(pathname) === ROUTES.contact;
}

export function isLayoutsPath(pathname: string): boolean {
  return normalizePath(pathname) === ROUTES.layouts;
}
