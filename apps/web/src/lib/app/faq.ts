import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/locales";

export type { ParsedFaqMarkdown } from "./faqParse";
export { FAQ_HEADING_OFFSET, parseFaqMarkdown } from "./faqParse";

export interface FaqItem {
  slug: string;
  question: string;
  /** Build-time GFM HTML (`#` already shifted to h3). */
  html: string;
}

const FAQ_FILE = /\/translations\/faq\/([^/]+)\/([^/]+)\.md$/;

const faqFiles: Record<string, { question: string; html: string }> = import.meta.glob(
  "../i18n/translations/faq/*/*.md",
  {
    eager: true,
    import: "default",
  },
);

function faqFileRef(path: string): { locale: Locale; slug: string } | null {
  const match = path.replaceAll("\\", "/").match(FAQ_FILE);
  if (!match) {
    return null;
  }
  const folder = match[1];
  const slug = match[2];
  if (!isLocale(folder) || !slug) {
    return null;
  }
  return { locale: folder, slug };
}

function itemsForLocale(locale: Locale): FaqItem[] {
  return Object.keys(faqFiles)
    .flatMap((path) => {
      const ref = faqFileRef(path);
      if (!ref || ref.locale !== locale) {
        return [];
      }
      const article = faqFiles[path];
      if (article == null) {
        throw new Error(`missing FAQ file ${path}`);
      }
      return [{ slug: ref.slug, question: article.question, html: article.html }];
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export const FAQ_CATALOGS: Record<Locale, FaqItem[]> = {
  en: itemsForLocale("en"),
  pl: itemsForLocale("pl"),
};

/** Prefer `preferred` per slug; missing slugs stay on the English fallback list. */
export function mergeFaqBySlug(preferred: FaqItem[], fallback: FaqItem[]): FaqItem[] {
  const bySlug = new Map(preferred.map((item) => [item.slug, item]));
  return fallback.map((item) => bySlug.get(item.slug) ?? item);
}

/** Articles for a locale. Unknown codes and missing slugs fall back to English. */
export function faqItemsFor(locale: Locale): FaqItem[] {
  switch (locale) {
    case "pl":
      return mergeFaqBySlug(FAQ_CATALOGS.pl, FAQ_CATALOGS[DEFAULT_LOCALE]);
    case "en":
    default:
      return FAQ_CATALOGS[DEFAULT_LOCALE];
  }
}

/** English articles (tests and first paint). */
export const FAQ_ITEMS: FaqItem[] = faqItemsFor(DEFAULT_LOCALE);
