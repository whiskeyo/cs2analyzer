import type { Messages } from "../../messages";

export const nav = {
  nav: {
    site: "Witryna",
    analyzer: "Analyzer",
    playbook: "Playbook",
    faq: "FAQ",
  },
  header: {
    homeAria: "Strona główna",
    brand: "CS2 Analyzer",
    preRelease: "[testy przedpremierowe]",
    preReleaseTip:
      "Zmiany mogą nie być wstecznie kompatybilne. Notatki zapisane w tej przeglądarce mogą przestać działać po nowszych wersjach.",
    newDemo: "Nowe demo",
    exportCsv: "Eksportuj CSV",
    exportCsvAggregatedTitle: "Eksport CSV jest per demo; wyłącz Aggregated",
  },
  headerMeta: {
    match: "{kills} fragów · {nades} nades",
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
    donate: "Wesprzyj",
    attribution:
      "Autor: whiskeyo (wersja {version}). Projekt fanowski — niepowiązany z Valve ani FACEIT. Radary map pochodzą od Valve z {radarSource}. Ikony broni z {weaponMit} (MIT) i {weaponOther}.",
  },
} satisfies Pick<Messages, "nav" | "header" | "headerMeta" | "pageTitle" | "credits">;
