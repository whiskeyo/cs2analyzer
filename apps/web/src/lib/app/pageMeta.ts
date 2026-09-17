import { isLayoutsPath, normalizePath, ROUTES } from "./routes";

export const SITE_NAME = "CS2 Analyzer";
export const SITE_ORIGIN = "https://cs2analyzer.whiskeyo.pl";
export const OG_IMAGE_URL = `${SITE_ORIGIN}/og-image.png`;
export const OG_TYPE = "website";
export const OG_LOCALE = "en_US";
export const TWITTER_CARD = "summary_large_image";

export type PageMeta = {
  title: string;
  description: string;
  canonical: string;
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

const HOME_DESCRIPTION =
  "Free local-first Counter-Strike 2 GOTV demo viewer. Parse a CS2 demo in the browser; the file stays on this machine.";

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

const LAYOUTS_META: Omit<PageMeta, "canonical"> = {
  title: `${SITE_NAME} — Layouts`,
  description: "Edit radar callout layouts for the local CS2 viewer.",
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
      "Local-first: Counter-Strike 2 GOTV demos are parsed in the browser and stay on this device.",
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

function upsertJsonLd(payload: SiteJsonLd): void {
  let tag = document.head.querySelector('script[type="application/ld+json"]');
  if (!(tag instanceof HTMLScriptElement)) {
    tag = document.createElement("script");
    tag.setAttribute("type", "application/ld+json");
    document.head.appendChild(tag);
  }
  tag.textContent = JSON.stringify(payload);
}

export function applyPageMeta(pathname: string): void {
  const { title, description, canonical } = pageMeta(pathname);
  document.title = title;
  upsertMeta("name", "description", description);
  upsertLink("canonical", canonical);

  const openGraph: Record<string, string> = {
    type: OG_TYPE,
    site_name: SITE_NAME,
    title,
    description,
    url: canonical,
    image: OG_IMAGE_URL,
    locale: OG_LOCALE,
  };
  for (const [key, value] of Object.entries(openGraph)) {
    upsertMeta("property", `og:${key}`, value);
  }

  upsertMeta("name", "twitter:card", TWITTER_CARD);
  const twitter: Record<string, string> = {
    title,
    description,
    image: OG_IMAGE_URL,
  };
  for (const [key, value] of Object.entries(twitter)) {
    upsertMeta("name", `twitter:${key}`, value);
  }

  upsertJsonLd(siteJsonLd());
}
