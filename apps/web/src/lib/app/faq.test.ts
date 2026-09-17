import { describe, expect, it } from "vitest";
import { FEATURE_LIST_CLASS } from "@/lib/markdown/featureList";
import { FAQ_ITEMS, parseFaqMarkdown } from "./faq";

describe("parseFaqMarkdown", () => {
  it("keeps the whole file and reads the first heading as the question", () => {
    const src = `# How is rating calculated?\n\nInline $KAST$ and a block:\n\n$$\nR = 1\n$$\n\n## Notes\n\nMore detail.`;
    const item = parseFaqMarkdown(src);
    expect(item.question).toBe("How is rating calculated?");
    expect(item.markdown).toBe(src);
    expect(item.markdown).toContain("## Notes");
  });

  it("rejects a file with no heading", () => {
    expect(() => parseFaqMarkdown("just a paragraph")).toThrow(/must start with a "# Question"/);
  });
});

describe("FAQ_ITEMS", () => {
  it("loads numbered articles from content/faq as precompiled HTML", () => {
    expect(FAQ_ITEMS.map((item) => item.question)).toEqual([
      "What is CS2 Analyzer?",
      "How safe is it?",
      "Why is it free?",
      "How do saved analyses and playbooks work?",
      "GOTV or POV? What is the difference?",
      "Which browsers work?",
      "What does pre-release mean?",
      "How do I report a bug or request a feature?",
    ]);
    for (const item of FAQ_ITEMS) {
      expect(item.html).toContain(`<h3>${item.question}</h3>`);
      expect(item.html).not.toContain("react-markdown");
    }
    const overview = FAQ_ITEMS[0];
    expect(overview?.html).toContain(`<ul class="${FEATURE_LIST_CLASS}">`);
    expect(
      overview?.html.match(new RegExp(`<ul class="${FEATURE_LIST_CLASS}">`, "g")),
    ).toHaveLength(4);
  });
});
