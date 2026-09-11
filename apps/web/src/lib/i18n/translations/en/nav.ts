import type { Messages } from "../../messages";

export const nav = {
  nav: {
    site: "Site",
    analyzer: "Analyzer",
    playbook: "Playbook",
    faq: "FAQ",
  },
  header: {
    homeAria: "Home",
    brand: "CS2 Analyzer",
    preRelease: "[pre-release testing]",
    preReleaseTip:
      "Changes may not be backward compatible. Notes saved in this browser might stop working after newer versions.",
    newDemo: "New demo",
    exportCsv: "Export CSV",
    exportCsvAggregatedTitle: "Export CSV is per-demo; switch off Aggregated",
  },
  headerMeta: {
    match: "{kills} kills · {nades} nades",
    overtime: "OT {a}:{b}",
  },
  pageTitle: {
    home: "CS2 Analyzer",
    analyzer: "Analyzer · CS2 Analyzer",
    playbook: "Playbook · CS2 Analyzer",
    faq: "FAQ · CS2 Analyzer",
  },
  credits: {
    github: "GitHub",
    issues: "Issues",
    donate: "Donate",
    attribution:
      "Made by whiskeyo. Version: {version}. Fan project — not affiliated with Valve or FACEIT. Radar overviews are Valve's, vendored from {radarSource}. Weapon icons from {weaponMit} (MIT) and {weaponOther}.",
  },
} satisfies Pick<Messages, "nav" | "header" | "headerMeta" | "pageTitle" | "credits">;
