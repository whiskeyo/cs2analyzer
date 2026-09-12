import type { Messages } from "../../messages";

export const faq = {
  faq: {
    title: "FAQ",
    lead: "Short answers for a local-first GOTV viewer. Drop a demo on the home page, or open Analyzer for saved notes.",
    whatIs: {
      question: "What is CS2 Analyzer?",
      body: "A local-first Counter-Strike 2 GOTV demo viewer. Drop a replay to watch it on a 2D radar, with a FACEIT-style scoreboard, utility, clutches, round story, and drawing tools.",
    },
    privacy: {
      question: "Do my demos leave this computer?",
      body: "No. Parsing runs in your browser (Web Worker + WASM). The file is not uploaded. Notes and drawings stay in this browser until you export a JSON backup from Settings.",
    },
    whatToDrop: {
      question: "What can I drop?",
      body: "A Source 2 GOTV {dem} — FACEIT, Premier, or matchmaking. One file opens the match. Several files open habits analysis (same map, or mixed maps with a map picker). You can also import a notes JSON backup from Settings.",
    },
    savedNotes: {
      question: "How do saved notes work?",
      body: "Drawings auto-save in this browser. The demo itself is not stored, so Open asks you to drop the same {dem} (or a linked file) to restore them. Export a JSON backup from Settings so a cache wipe does not eat them.",
    },
    stats: {
      question: "What kind of stats are these?",
      intro:
        "Live, tick-accurate board through the current playhead: K/D/A, ADR, KAST, rating, entry, money, and CT/T splits.",
      adrHeading: "ADR and trades",
      adrBody: "ADR is enemy health damage capped at remaining HP. Trades use a 5-second window.",
      sidesHeading: "Sides and overtime",
      sidesBody:
        "Side swaps and overtime follow competitive scoring, not a raw CT-vs-T round count.",
    },
    gotvOrPov: {
      question: "GOTV or POV?",
      body: "GOTV is the supported path. POV demos are a different recording and are not what the radar, HUD, and stats are built for.",
    },
    browsers: {
      question: "Which browsers work?",
      body: "A current Chromium, Firefox, or Safari build with WebAssembly and Web Workers. Linking a demo file so Open can reload it without re-dropping uses the File System Access API, which is Chromium-only.",
    },
    affiliation: {
      question: "Is this affiliated with Valve or FACEIT?",
      body: "No. This is a fan project. Radar overviews and weapon icons are vendored community/Valve assets for offline use — we do not claim ownership.",
    },
    preRelease: {
      question: "The site says pre-release — should I worry?",
      body: "The live site is still in testing. Parser and notes formats can change; saved notes in this browser might stop loading after a newer version. Export a JSON backup if the drawings matter.",
    },
    report: {
      question: "How do I report a bug or request a feature?",
      body: "Open an issue on {issues}. Include the map, whether it was a single demo or a series, and what you expected to see.",
      issuesLink: "GitHub Issues",
    },
  },
} satisfies Pick<Messages, "faq">;
