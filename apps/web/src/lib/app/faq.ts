export type { ParsedFaqMarkdown } from "./faqParse";
export { FAQ_HEADING_OFFSET, parseFaqMarkdown } from "./faqParse";

export interface FaqItem {
  question: string;
  /** Build-time GFM HTML (`#` already shifted to h3). */
  html: string;
}

const faqFiles: Record<string, FaqItem> = import.meta.glob("../../content/faq/*.md", {
  eager: true,
  import: "default",
});

/** Articles in `src/content/faq/`, ordered by filename. */
export const FAQ_ITEMS: FaqItem[] = Object.keys(faqFiles)
  .sort((a, b) => a.localeCompare(b))
  .map((path) => {
    const article = faqFiles[path];
    if (article == null) {
      throw new Error(`missing FAQ file ${path}`);
    }
    return article;
  });
