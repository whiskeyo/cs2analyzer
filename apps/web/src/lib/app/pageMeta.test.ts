/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import {
  applyPageMeta,
  OG_IMAGE_URL,
  OG_LOCALE,
  OG_TYPE,
  SITE_NAME,
  SITE_ORIGIN,
  TWITTER_CARD,
  canonicalUrl,
  pageMeta,
  pageTitle,
  siteJsonLd,
} from "./pageMeta";

function metaContent(kind: "name" | "property", key: string): string | null {
  return document.head.querySelector(`meta[${kind}="${key}"]`)?.getAttribute("content") ?? null;
}

function canonicalHref(): string | null {
  return document.head.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null;
}

describe("pageMeta", () => {
  it("uses distinct titles and descriptions per known route", () => {
    expect(pageTitle("/")).toBe(SITE_NAME);
    expect(pageTitle("/analyzer")).toBe("CS2 Analyzer — Analyzer");
    expect(pageTitle("/playbook")).toBe("CS2 Analyzer — Playbook");
    expect(pageTitle("/faq")).toBe("CS2 Analyzer — FAQ");
    expect(pageTitle("/faq/")).toBe("CS2 Analyzer — FAQ");
    expect(pageTitle("/rating")).toBe("CS2 Analyzer — Rating");
    expect(pageTitle("/contact")).toBe("CS2 Analyzer — Contact");
    expect(pageMeta("/").description).toMatch(/Free local-first Counter-Strike 2 GOTV demo/);
    expect(pageMeta("/").description).toMatch(/CS2 demo/);
    expect(pageMeta("/").description).toMatch(/browser/);
    expect(pageMeta("/analyzer").description).toMatch(/demo/);
    expect(pageMeta("/playbook").description).toMatch(/playbook/i);
    expect(pageMeta("/faq").description).toMatch(/FAQ|answers/i);
    expect(pageMeta("/rating").description).toMatch(/rating/i);
    expect(pageMeta("/contact").description).toMatch(/Email|Steam|GitHub/);
  });

  it("uses the 404 title for unknown paths", () => {
    expect(pageTitle("/this-page-does-not-exist")).toBe("CS2 Analyzer — Page not found");
    expect(pageTitle("/contact")).not.toBe("CS2 Analyzer — Page not found");
    expect(pageMeta("/missing").description).toBe("This page does not exist.");
  });

  it("names the layouts editor in development", () => {
    expect(pageTitle("/layouts")).toBe(
      import.meta.env.DEV ? "CS2 Analyzer — Layouts" : "CS2 Analyzer — Page not found",
    );
  });

  it("builds absolute canonical URLs", () => {
    expect(canonicalUrl("/")).toBe(`${SITE_ORIGIN}/`);
    expect(pageMeta("/").canonical).toBe(`${SITE_ORIGIN}/`);
    expect(pageMeta("/faq").canonical).toBe(`${SITE_ORIGIN}/faq`);
    expect(pageMeta("/faq/").canonical).toBe(`${SITE_ORIGIN}/faq`);
    expect(pageMeta("/missing").canonical).toBe(`${SITE_ORIGIN}/missing`);
  });
});

describe("applyPageMeta", () => {
  it("sets title, description, canonical, and key OG tags on home", () => {
    applyPageMeta("/");
    const home = pageMeta("/");
    expect(document.title).toBe(SITE_NAME);
    expect(metaContent("name", "description")).toBe(home.description);
    expect(canonicalHref()).toBe(`${SITE_ORIGIN}/`);
    expect(metaContent("property", "og:type")).toBe(OG_TYPE);
    expect(metaContent("property", "og:site_name")).toBe(SITE_NAME);
    expect(metaContent("property", "og:title")).toBe(SITE_NAME);
    expect(metaContent("property", "og:description")).toBe(home.description);
    expect(metaContent("property", "og:url")).toBe(`${SITE_ORIGIN}/`);
    expect(metaContent("property", "og:image")).toBe(OG_IMAGE_URL);
    expect(metaContent("property", "og:locale")).toBe(OG_LOCALE);
    expect(metaContent("name", "twitter:card")).toBe(TWITTER_CARD);
    expect(metaContent("name", "twitter:title")).toBe(SITE_NAME);
    expect(metaContent("name", "twitter:image")).toBe(OG_IMAGE_URL);
  });

  it("sets title, description, canonical, and key OG tags on FAQ", () => {
    applyPageMeta("/faq");
    const faq = pageMeta("/faq");
    expect(document.title).toBe("CS2 Analyzer — FAQ");
    expect(metaContent("name", "description")).toBe(faq.description);
    expect(canonicalHref()).toBe(`${SITE_ORIGIN}/faq`);
    expect(metaContent("property", "og:title")).toBe(faq.title);
    expect(metaContent("property", "og:description")).toBe(faq.description);
    expect(metaContent("property", "og:url")).toBe(faq.canonical);
    expect(metaContent("property", "og:image")).toBe(OG_IMAGE_URL);
    expect(metaContent("property", "og:type")).toBe(OG_TYPE);
  });

  it("uses 404 copy and a canonical for unknown paths", () => {
    applyPageMeta("/this-page-does-not-exist");
    const missing = pageMeta("/this-page-does-not-exist");
    expect(document.title).toBe("CS2 Analyzer — Page not found");
    expect(metaContent("name", "description")).toBe("This page does not exist.");
    expect(canonicalHref()).toBe(`${SITE_ORIGIN}/this-page-does-not-exist`);
    expect(metaContent("property", "og:title")).toBe(missing.title);
    expect(metaContent("property", "og:description")).toBe(missing.description);
    expect(metaContent("property", "og:url")).toBe(missing.canonical);
  });

  it("upserts tags instead of duplicating them", () => {
    applyPageMeta("/");
    applyPageMeta("/faq");
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[name="twitter:card"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
    expect(canonicalHref()).toBe(`${SITE_ORIGIN}/faq`);
  });
});

describe("siteJsonLd", () => {
  it("describes a free local-first browser app", () => {
    applyPageMeta("/");
    const payload = siteJsonLd();
    expect(payload["@type"]).toEqual(["SoftwareApplication", "WebApplication"]);
    expect(payload.name).toBe(SITE_NAME);
    expect(payload.url).toBe(`${SITE_ORIGIN}/`);
    expect(payload.description).toBe(pageMeta("/").description);
    expect(payload.isAccessibleForFree).toBe(true);
    expect(payload.offers.price).toBe("0");
    expect(payload.operatingSystem).toMatch(/browser/i);
    expect(payload.featureList).toMatch(/local-first/i);
    const script = document.head.querySelector('script[type="application/ld+json"]');
    expect(script).toBeTruthy();
    expect(JSON.parse(script?.textContent ?? "")).toEqual(payload);
  });
});
