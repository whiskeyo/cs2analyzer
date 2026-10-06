import { NOT_FOUND_PRERENDER_PATH, PRERENDER_PATH_ATTR } from "./hydrateDocument";
import { JSON_LD_SOFTWARE, pageHead, type JsonLdGraph } from "./pageMeta";
import { normalizePath, ROUTES } from "./routes";

export { NOT_FOUND_PRERENDER_PATH };

/** Public routes emitted as real HTML at build time. `/layouts` is DEV-only. */
export const PRERENDER_PATHS = [
  ROUTES.home,
  ROUTES.analyzer,
  ROUTES.tutorial,
  `${ROUTES.tutorial}/single`,
  `${ROUTES.tutorial}/aggregated`,
  `${ROUTES.tutorial}/playbook`,
  ROUTES.playbook,
  ROUTES.faq,
  ROUTES.rating,
  ROUTES.contact,
] as const;

/**
 * `NOT_FOUND_PRERENDER_PATH` is rendered into `dist/404.html`. Not a public
 * route (must stay out of `PRERENDER_PATHS`, or `/404/` would be a 200 directory).
 */

/** React 19 `renderToString` emits image preloads into the body; `hydrateRoot` does not. */
export function stripSsrHoistables(markup: string): string {
  return markup.replace(/<link\b[^>]*\brel="preload"[^>]*>/g, "");
}
export function prerenderFilePath(pathname: string): string {
  const path = normalizePath(pathname);
  if (path === ROUTES.home) {
    return "index.html";
  }
  return `${path.slice(1)}/index.html`;
}

function escapeAttr(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceMeta(
  html: string,
  kind: "name" | "property",
  key: string,
  content: string,
): string {
  const tag = `<meta ${kind}="${key}" content="${escapeAttr(content)}" />`;
  const re = new RegExp(`<meta\\b[^>]*\\b${kind}="${escapeRegExp(key)}"[^>]*>`, "i");
  if (re.test(html)) {
    return html.replace(re, tag);
  }
  return html.replace("</head>", `    ${tag}\n  </head>`);
}

function replaceRobots(html: string, content: string | null): string {
  const re = /<meta\b[^>]*\bname="robots"[^>]*>/i;
  if (content == null) {
    return html.replace(re, "");
  }
  const tag = `<meta name="robots" content="${escapeAttr(content)}" />`;
  if (re.test(html)) {
    return html.replace(re, tag);
  }
  return html.replace("</head>", `    ${tag}\n  </head>`);
}

function replaceCanonical(html: string, href: string | null): string {
  const re = /<link\b[^>]*\brel="canonical"[^>]*>/i;
  if (href == null) {
    return html.replace(re, "");
  }
  const tag = `<link rel="canonical" href="${escapeAttr(href)}" />`;
  if (re.test(html)) {
    return html.replace(re, tag);
  }
  return html.replace("</head>", `    ${tag}\n  </head>`);
}

function jsonLdScript(id: string, payload: JsonLdGraph): string {
  const json = JSON.stringify(payload).replaceAll("<", "\\u003c");
  return `<script type="application/ld+json" data-seo="${id}">${json}</script>`;
}

function upsertJsonLdHtml(html: string, id: string, payload: JsonLdGraph | null): string {
  const keyed = new RegExp(
    `<script\\b[^>]*type="application/ld\\+json"[^>]*data-seo="${escapeRegExp(id)}"[^>]*>[\\s\\S]*?</script>`,
    "i",
  );
  if (payload == null) {
    return html.replace(keyed, "");
  }
  const tag = jsonLdScript(id, payload);
  if (keyed.test(html)) {
    return html.replace(keyed, tag);
  }
  if (id === JSON_LD_SOFTWARE) {
    const unlabeled = /<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/i;
    if (unlabeled.test(html)) {
      return html.replace(unlabeled, tag);
    }
  }
  return html.replace("</head>", `    ${tag}\n  </head>`);
}

/**
 * Stamp route-specific title, canonical, social tags, JSON-LD, and `#root`
 * markup onto the Vite `index.html` template.
 */
export function injectPrerenderedPage(template: string, pathname: string, body: string): string {
  const head = pageHead(pathname);
  let html = template.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(head.title)}</title>`);
  html = replaceMeta(html, "name", "description", head.description);
  html = replaceCanonical(html, head.canonical);
  html = replaceRobots(html, head.robots);
  for (const [key, value] of Object.entries(head.openGraph)) {
    html = replaceMeta(html, "property", `og:${key}`, value);
  }
  for (const [key, value] of Object.entries(head.twitter)) {
    html = replaceMeta(html, "name", `twitter:${key}`, value);
  }
  for (const block of head.jsonLd) {
    html = upsertJsonLdHtml(html, block.id, block.payload);
  }
  const markup = stripSsrHoistables(body);
  const renderedFor = escapeAttr(normalizePath(pathname));
  const withRoot = html.replace(
    /<div id="root">\s*<\/div>/,
    `<div id="root" ${PRERENDER_PATH_ATTR}="${renderedFor}">${markup}</div>`,
  );
  if (withRoot === html) {
    throw new Error(`prerender: missing empty #root in template (${pathname})`);
  }
  return withRoot;
}
