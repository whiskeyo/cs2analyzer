import { parseTutorialPath } from "@/lib/tutorial/query";
import { isLayoutsPath, normalizePath, ROUTES } from "./routes";

export const SITE_NAME = "CS2 Analyzer";
export const SITE_ORIGIN = "https://cs2analyzer.whiskeyo.pl";
export const OG_IMAGE_URL = `${SITE_ORIGIN}/og-image.png`;
export const OG_TYPE = "website";
export const OG_LOCALE = "en_US";
export const TWITTER_CARD = "summary_large_image";

/** `data-seo` on JSON-LD scripts so client navigations upsert without clobbering. */
export const JSON_LD_SOFTWARE = "software-application";
export const JSON_LD_BREADCRUMB = "breadcrumb-list";

export type PageMeta = {
  title: string;
  description: string;
  canonical: string;
};

export type BreadcrumbCrumb = {
  name: string;
  path: string;
};

export type SiteJsonLd = {
  "@context": "https://schema.org";
  "@type": ["SoftwareApplication", "WebApplication"];
  name: string;
  url: string;
  description: string;
  applicationCategory: "WebApplication";
  operatingSystem: "Web browser";
  browserRequirements: string;
  isAccessibleForFree: true;
  offers: {
    "@type": "Offer";
    price: "0";
    priceCurrency: "USD";
  };
  featureList: string;
};

export type BreadcrumbListJsonLd = {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: {
    "@type": "ListItem";
    position: number;
    name: string;
    item: string;
  }[];
};

export type JsonLdGraph = SiteJsonLd | BreadcrumbListJsonLd;

export type JsonLdBlock = {
  id: string;
  payload: JsonLdGraph | null;
};

export type PageHead = {
  title: string;
  description: string;
  canonical: string;
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  jsonLd: JsonLdBlock[];
};

const CRUMB_LABELS: Record<string, string> = {
  [ROUTES.analyzer]: "Analyzer",
  [ROUTES.tutorial]: "Tutorial",
  [ROUTES.playbook]: "Playbook",
  [ROUTES.faq]: "FAQ",
  [ROUTES.rating]: "Rating",
  [ROUTES.contact]: "Contact",
};

const HOME_DESCRIPTION =
  "Free local-first Counter-Strike 2 GOTV demo analyzer and playbook. Parse a CS2 demo in the browser, or draw and export strats; files stay on this machine.";

/** Titles use an em dash, e.g. `CS2 Analyzer — Playbook`. */
const PAGE_META: Record<string, Omit<PageMeta, "canonical">> = {
  [ROUTES.home]: {
    title: SITE_NAME,
    description: HOME_DESCRIPTION,
  },
  [ROUTES.analyzer]: {
    title: `${SITE_NAME} — Analyzer`,
    description: "Open a Counter-Strike 2 demo on this machine and review radar, stats, and notes.",
  },
  [ROUTES.tutorial]: {
    title: `${SITE_NAME} — Tutorial`,
    description:
      "Try the local-first CS2 analyzer with a short sample match, habits series, and playbook. No file drop.",
  },
  [`${ROUTES.tutorial}/single`]: {
    title: `${SITE_NAME} — Tutorial`,
    description:
      "Try the local-first CS2 analyzer with a short sample match, habits series, and playbook. No file drop.",
  },
  [`${ROUTES.tutorial}/aggregated`]: {
    title: `${SITE_NAME} — Tutorial`,
    description:
      "Try the local-first CS2 analyzer with a short sample match, habits series, and playbook. No file drop.",
  },
  [`${ROUTES.tutorial}/playbook`]: {
    title: `${SITE_NAME} — Tutorial`,
    description:
      "Try the local-first CS2 analyzer with a short sample match, habits series, and playbook. No file drop.",
  },
  [ROUTES.playbook]: {
    title: `${SITE_NAME} — Playbook`,
    description: "Draw CS2 strats on a 2D radar and export a local playbook.",
  },
  [ROUTES.faq]: {
    title: `${SITE_NAME} — FAQ`,
    description: "Short answers for the local-first CS2 GOTV analyzer.",
  },
  [ROUTES.rating]: {
    title: `${SITE_NAME} — Rating`,
    description: "Proprietary match rating formulas: 1.00–10.00+ scale, developed by whiskeyo.",
  },
  [ROUTES.contact]: {
    title: `${SITE_NAME} — Contact`,
    description: "Email, Steam, and GitHub for the local-first CS2 GOTV analyzer.",
  },
};

const LAYOUTS_META: Omit<PageMeta, "canonical"> = {
  title: `${SITE_NAME} — Layouts`,
  description: "Edit radar callout layouts for the local CS2 analyzer.",
};

const NOT_FOUND_META: Omit<PageMeta, "canonical"> = {
  title: `${SITE_NAME} — Page not found`,
  description: "This page does not exist.",
};

/** Absolute URL for a pathname (`/` keeps a trailing slash). */
export function canonicalUrl(pathname: string): string {
  const path = normalizePath(pathname);
  if (path === ROUTES.home) {
    return `${SITE_ORIGIN}/`;
  }
  return `${SITE_ORIGIN}${path}`;
}

/**
 * Document title, description, and canonical URL for a pathname.
 * Unknown paths use the 404 copy.
 */
export function pageMeta(pathname: string): PageMeta {
  const path = normalizePath(pathname);
  const copy =
    import.meta.env.DEV && isLayoutsPath(path) ? LAYOUTS_META : (PAGE_META[path] ?? NOT_FOUND_META);
  return { ...copy, canonical: canonicalUrl(path) };
}

export function pageTitle(pathname: string): string {
  return pageMeta(pathname).title;
}

export function siteJsonLd(): SiteJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": ["SoftwareApplication", "WebApplication"],
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    description: HOME_DESCRIPTION,
    applicationCategory: "WebApplication",
    operatingSystem: "Web browser",
    browserRequirements: "Requires a JavaScript-enabled web browser.",
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList:
      "Local-first: parse Counter-Strike 2 GOTV demos in the browser and draw or export playbook strats; files stay on this device.",
  };
}

/**
 * Logical trail for public routes. No on-screen breadcrumbs, and FAQ articles
 * share `/faq` (no nested article URLs). Home and unknown paths have none.
 */
export function breadcrumbTrail(pathname: string): BreadcrumbCrumb[] | null {
  const path = normalizePath(pathname);
  const tutorial = parseTutorialPath(path);
  if (tutorial === "replay") {
    return [
      { name: "Home", path: ROUTES.home },
      { name: "Tutorial", path: ROUTES.tutorial },
      { name: "Single", path: `${ROUTES.tutorial}/single` },
    ];
  }
  if (tutorial === "aggregated") {
    return [
      { name: "Home", path: ROUTES.home },
      { name: "Tutorial", path: ROUTES.tutorial },
      { name: "Aggregated", path: `${ROUTES.tutorial}/aggregated` },
    ];
  }
  if (tutorial === "playbook") {
    return [
      { name: "Home", path: ROUTES.home },
      { name: "Tutorial", path: ROUTES.tutorial },
      { name: "Playbook", path: `${ROUTES.tutorial}/playbook` },
    ];
  }
  const label = CRUMB_LABELS[path];
  if (!label) {
    return null;
  }
  return [
    { name: "Home", path: ROUTES.home },
    { name: label, path },
  ];
}

export function breadcrumbJsonLd(pathname: string): BreadcrumbListJsonLd | null {
  const trail = breadcrumbTrail(pathname);
  if (!trail) {
    return null;
  }
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: canonicalUrl(crumb.path),
    })),
  };
}

/** Title, social tags, and JSON-LD graphs for a pathname (prerender + client). */
export function pageHead(pathname: string): PageHead {
  const { title, description, canonical } = pageMeta(pathname);
  return {
    title,
    description,
    canonical,
    openGraph: {
      type: OG_TYPE,
      site_name: SITE_NAME,
      title,
      description,
      url: canonical,
      image: OG_IMAGE_URL,
      locale: OG_LOCALE,
    },
    twitter: {
      card: TWITTER_CARD,
      title,
      description,
      image: OG_IMAGE_URL,
    },
    jsonLd: [
      { id: JSON_LD_SOFTWARE, payload: siteJsonLd() },
      { id: JSON_LD_BREADCRUMB, payload: breadcrumbJsonLd(pathname) },
    ],
  };
}

function upsertMeta(kind: "name" | "property", key: string, content: string): void {
  const selector = `meta[${kind}="${key}"]`;
  let tag = document.head.querySelector(selector);
  if (!(tag instanceof HTMLMetaElement)) {
    tag = document.createElement("meta");
    tag.setAttribute(kind, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertLink(rel: string, href: string): void {
  const selector = `link[rel="${rel}"]`;
  let tag = document.head.querySelector(selector);
  if (!(tag instanceof HTMLLinkElement)) {
    tag = document.createElement("link");
    tag.setAttribute("rel", rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

function upsertJsonLd(id: string, payload: JsonLdGraph | null): void {
  const selector = `script[type="application/ld+json"][data-seo="${id}"]`;
  let tag = document.head.querySelector(selector);
  if (payload == null) {
    tag?.remove();
    return;
  }
  if (!(tag instanceof HTMLScriptElement) && id === JSON_LD_SOFTWARE) {
    const unlabeled = [
      ...document.head.querySelectorAll('script[type="application/ld+json"]'),
    ].find((el) => !el.hasAttribute("data-seo"));
    if (unlabeled instanceof HTMLScriptElement) {
      tag = unlabeled;
      tag.setAttribute("data-seo", id);
    }
  }
  if (!(tag instanceof HTMLScriptElement)) {
    tag = document.createElement("script");
    tag.setAttribute("type", "application/ld+json");
    tag.setAttribute("data-seo", id);
    document.head.appendChild(tag);
  }
  tag.textContent = JSON.stringify(payload);
}

export function applyPageMeta(pathname: string): void {
  const head = pageHead(pathname);
  document.title = head.title;
  upsertMeta("name", "description", head.description);
  upsertLink("canonical", head.canonical);

  for (const [key, value] of Object.entries(head.openGraph)) {
    upsertMeta("property", `og:${key}`, value);
  }
  for (const [key, value] of Object.entries(head.twitter)) {
    upsertMeta("name", `twitter:${key}`, value);
  }
  for (const block of head.jsonLd) {
    upsertJsonLd(block.id, block.payload);
  }
}
