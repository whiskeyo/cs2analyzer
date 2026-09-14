import { describe, expect, it } from "vitest";
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
      "Do my demos leave this computer?",
      "What can I drop?",
      "How do saved notes work?",
      "What kind of stats are these?",
      "GOTV or POV?",
      "Which browsers work?",
      "Is this affiliated with Valve or FACEIT?",
      "The site says pre-release — should I worry?",
      "How do I report a bug or request a feature?",
      "Why did a demo stop parsing after a CS2 update?",
    ]);
    for (const item of FAQ_ITEMS) {
      expect(item.html).toContain(`<h3>${item.question}</h3>`);
      expect(item.html).not.toContain("react-markdown");
    }
  });

  it("documents the source2-demo bump procedure after a CS2 proto break", () => {
    const article = FAQ_ITEMS.find((item) => item.question.includes("CS2 update"));
    expect(article).toBeDefined();
    expect(article?.html).toContain("source2-demo");
    expect(article?.html).toMatch(/Do not (hand-edit|patch) generated proto/i);
    expect(article?.html).toContain("build-wasm");
    expect(article?.html).toMatch(/re-drop/i);
    expect(article?.html).toContain("crates.io/crates/source2-demo");
  });
});
