import { isLayoutsPath, normalizePath, ROUTES } from "./routes";

export const SITE_NAME = "CS2 Analyzer";

export type PageMeta = {
  title: string;
  description: string;
};

const HOME_DESCRIPTION =
  "Local-first CS2 GOTV viewer. Parse a demo in the browser and review it on a 2D radar.";

/** Titles use an em dash, e.g. `CS2 Analyzer — Playbook`. */
const PAGE_META: Record<string, PageMeta> = {
  [ROUTES.home]: {
    title: SITE_NAME,
    description: HOME_DESCRIPTION,
  },
  [ROUTES.analyzer]: {
    title: `${SITE_NAME} — Analyzer`,
    description: "Open a Counter-Strike 2 demo on this machine and review radar, stats, and notes.",
  },
  [ROUTES.playbook]: {
    title: `${SITE_NAME} — Playbook`,
    description: "Draw CS2 strats on a 2D radar and export a local playbook.",
  },
  [ROUTES.faq]: {
    title: `${SITE_NAME} — FAQ`,
    description: "Short answers for the local-first CS2 GOTV viewer.",
  },
  [ROUTES.rating]: {
    title: `${SITE_NAME} — Rating`,
    description: "Proprietary match rating formulas: 1.00–10.00+ scale, developed by whiskeyo.",
  },
  [ROUTES.contact]: {
    title: `${SITE_NAME} — Contact`,
    description: "Email, Steam, and GitHub for the local-first CS2 GOTV viewer.",
  },
};

const LAYOUTS_META: PageMeta = {
  title: `${SITE_NAME} — Layouts`,
  description: "Edit radar callout layouts for the local CS2 viewer.",
};

const NOT_FOUND_META: PageMeta = {
  title: `${SITE_NAME} — Page not found`,
  description: "This page does not exist.",
};

/**
 * Document title and description for a pathname.
 * Unknown paths use the 404 copy.
 */
export function pageMeta(pathname: string): PageMeta {
  const path = normalizePath(pathname);
  if (import.meta.env.DEV && isLayoutsPath(path)) return LAYOUTS_META;
  return PAGE_META[path] ?? NOT_FOUND_META;
}

export function pageTitle(pathname: string): string {
  return pageMeta(pathname).title;
}

export function applyPageMeta(pathname: string): void {
  const { title, description } = pageMeta(pathname);
  document.title = title;
  let tag = document.querySelector('meta[name="description"]');
  if (!(tag instanceof HTMLMetaElement)) {
    tag = document.createElement("meta");
    tag.setAttribute("name", "description");
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", description);
}
