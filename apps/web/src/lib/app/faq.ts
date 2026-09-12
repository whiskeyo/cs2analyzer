import type { Messages } from "@/lib/i18n/messages";

/** Fixed article order. Copy comes from `messages.faq`; structure lives in `Faq.tsx`. */
export const FAQ_SLUGS = [
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
] as const;

export type FaqSlug = (typeof FAQ_SLUGS)[number];

/** Heading text for a slug. Locale is whichever catalog the caller passed. */
export function faqQuestion(faq: Messages["faq"], slug: FaqSlug): string {
  switch (slug) {
    case "what-is":
      return faq.whatIs.question;
    case "privacy":
      return faq.privacy.question;
    case "what-to-drop":
      return faq.whatToDrop.question;
    case "saved-notes":
      return faq.savedNotes.question;
    case "stats":
      return faq.stats.question;
    case "gotv-or-pov":
      return faq.gotvOrPov.question;
    case "browsers":
      return faq.browsers.question;
    case "affiliation":
      return faq.affiliation.question;
    case "pre-release":
      return faq.preRelease.question;
    case "report":
      return faq.report.question;
  }
}
