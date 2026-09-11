export interface ParsedFaqMarkdown {
  question: string;
  /** Full article Markdown, including the leading `#` heading. */
  markdown: string;
}

const TITLE = /^#\s+(.+?)(?:\r?\n|$)/;

/** Markdown `#` becomes h3 so it nests under the FAQ page h2. */
export const FAQ_HEADING_OFFSET = 2;

/** First `# heading` is the question; the whole file is compiled as Markdown. */
export function parseFaqMarkdown(raw: string, source = "faq"): ParsedFaqMarkdown {
  const markdown = raw.trim();
  const match = markdown.match(TITLE);
  const question = match?.[1].trim() ?? "";
  const rest = markdown.slice(match?.[0].length ?? 0).trim();
  if (!question || !rest) {
    throw new Error(`${source} must start with a "# Question" heading and a body`);
  }
  return { question, markdown };
}
