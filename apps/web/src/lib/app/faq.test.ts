import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/translations/en";
import { pl } from "@/lib/i18n/translations/pl";
import { FAQ_SLUGS, faqQuestion } from "./faq";

function faqLeaves(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (value == null || typeof value !== "object") {
    return [];
  }
  return Object.values(value).flatMap(faqLeaves);
}

describe("FAQ_SLUGS", () => {
  it("keeps the ten articles in a fixed order", () => {
    expect(FAQ_SLUGS).toEqual([
      "what-is",
      "privacy",
      "what-to-drop",
      "saved-notes",
      "stats",
      "gotv-or-pov",
      "browsers",
      "affiliation",
      "pre-release",
      "report",
    ]);
  });

  it("reads English questions from the catalog, not markdown", () => {
    expect(FAQ_SLUGS.map((slug) => faqQuestion(en.faq, slug))).toEqual([
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
  });

  it("reads Polish questions from the same keys, without a slug fallback merge", () => {
    expect(FAQ_SLUGS.map((slug) => faqQuestion(pl.faq, slug))).toEqual([
      "Czym jest CS2 Analyzer?",
      "Czy moje dema opuszczają ten komputer?",
      "Co mogę wrzucić?",
      "Jak działają zapisane notatki?",
      "Jakie to statystyki?",
      "GOTV czy POV?",
      "Które przeglądarki działają?",
      "Czy to jest powiązane z Valve albo FACEIT?",
      "Strona pisze pre-release — mam się martwić?",
      "Jak zgłosić buga albo poprosić o funkcję?",
    ]);
  });

  it("keeps inline code and the issues link as named slots", () => {
    expect(en.faq.whatToDrop.body).toContain("{dem}");
    expect(pl.faq.whatToDrop.body).toContain("{dem}");
    expect(en.faq.savedNotes.body).toContain("{dem}");
    expect(pl.faq.savedNotes.body).toContain("{dem}");
    expect(en.faq.report.body).toContain("{issues}");
    expect(pl.faq.report.body).toContain("{issues}");
    expect(en.faq.whatToDrop).not.toHaveProperty("bodyBefore");
    expect(en.faq.report).not.toHaveProperty("bodyBefore");
  });

  it("does not put math markup or a markdown pipeline in the catalog", () => {
    for (const text of [...faqLeaves(en.faq), ...faqLeaves(pl.faq)]) {
      expect(text).not.toMatch(/katex|react-markdown|\$\$|<math/i);
    }
  });
});
