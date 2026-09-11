import type { Messages } from "../../messages";

export const drop = {
  drop: {
    title: "Drop a demo",
    blurb:
      "One Counter-Strike 2 {dem} to watch the match, or several for habits (same map, or mixed maps with a map picker).",
    parsedLocal: "Parsed entirely in your browser.",
    savedLead:
      "Notes auto-save in this browser. The demo is not stored — drop the same {dem} to restore drawings. Export a JSON backup from Settings so a cache wipe does not eat them.",
    savedTitle: "Saved notes",
    unnamedDemo: "unnamed.dem",
    drawingOne: "{count} drawing",
    drawingOther: "{count} drawings",
    linked: "linked: {label}",
    player: "Player",
    linkDemo: "Link demo",
    linkDemoTitle: "Link this demo file so Open can load it without re-dropping",
    deleteNotes: "Delete",
    deleteNotesTitle: "Remove notes for this match",
    previous: "Previous",
    next: "Next",
    unknownTime: "unknown time",
    restoreTitle: "Restore notes",
    restoreBody: "Drop {file} here to restore those drawings. The demo itself is not stored.",
    close: "Close",
  },
  parse: {
    percent: "{pct}%",
    overall: "Overall {pct}%",
    done: "done",
    error: "err",
    queued: "…",
  },
} satisfies Pick<Messages, "drop" | "parse">;
