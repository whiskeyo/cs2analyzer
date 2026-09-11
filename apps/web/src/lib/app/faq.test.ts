import { describe, expect, it } from "vitest";
import { FAQ_CATALOGS, FAQ_ITEMS, faqItemsFor, mergeFaqBySlug, parseFaqMarkdown } from "./faq";

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
  it("loads numbered English articles from translations/faq as precompiled HTML", () => {
    expect(FAQ_ITEMS.map((item) => item.slug)).toEqual([
      "01-what-is",
      "02-privacy",
      "03-what-to-drop",
      "04-saved-notes",
      "05-stats",
      "06-gotv-or-pov",
      "07-browsers",
      "08-affiliation",
      "09-pre-release",
      "10-report",
    ]);
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
    ]);
    for (const item of FAQ_ITEMS) {
      expect(item.html).toContain(`<h3>${item.question}</h3>`);
      expect(item.html).not.toContain("react-markdown");
      expect(item.html).not.toMatch(/katex|<math/i);
    }
  });

  it("picks Polish bodies and falls a missing slug back to English", () => {
    const polish = faqItemsFor("pl");
    expect(polish).toHaveLength(FAQ_ITEMS.length);
    expect(polish[0]?.question).toBe("Czym jest CS2 Analyzer?");
    expect(polish[4]?.html).toContain("ADR i trade");
    expect(FAQ_CATALOGS.pl.map((item) => item.slug)).toEqual(FAQ_ITEMS.map((item) => item.slug));

    const onlyPrivacy = FAQ_CATALOGS.pl.filter((item) => item.slug === "02-privacy");
    const mixed = mergeFaqBySlug(onlyPrivacy, FAQ_ITEMS);
    expect(mixed[0]).toEqual(FAQ_ITEMS[0]);
    expect(mixed[1]?.question).toBe("Czy moje dema opuszczają ten komputer?");
    expect(faqItemsFor("de" as "en")).toEqual(FAQ_ITEMS);
  });
});
