import type { Messages } from "../../messages";

export const home = {
  home: {
    kicker: "Local-first GOTV viewer",
    title: "Watch Counter-Strike 2 demos on a 2D radar",
    lead: "Drop a replay and start reviewing on this machine. Parse, playback, stats, and drawings all run in the browser.",
    featureRadar: "Live radar, nades, tracking, and drawing.",
    featureScoreboard: "FACEIT-style scoreboard, clutches, utility, and round history.",
    featureHabits: "Habits mode: several demos, same map or mixed maps.",
    featureKillfeed: "Kill feed, opening duels, nade summary, and CSV export.",
    featureMore: "And way more!",
    faqHint: "If you have questions, {faqLink}.",
    faqLink: "see the FAQ",
  },
  faq: {
    title: "FAQ",
    lead: "Short answers for a local-first GOTV viewer. Drop a demo on the home page, or open Analyzer for saved notes.",
  },
} satisfies Pick<Messages, "home" | "faq">;
