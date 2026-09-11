import type { Messages } from "../../messages";

export const drop = {
  drop: {
    title: "Upuść demo",
    blurb:
      "Jedno demo Counter-Strike 2 ({dem}), żeby obejrzeć mecz, albo kilka do Habits (ta sama mapa albo mieszane mapy z wyborem mapy).",
    parsedLocal: "Parsowane w całości w Twojej przeglądarce.",
    savedLead:
      "Notatki zapisują się same w tej przeglądarce. Demo nie jest przechowywane — upuść ten sam {dem}, żeby przywrócić rysunki. Zrób kopię JSON w Ustawieniach, żeby czyszczenie cache ich nie zjadło.",
    savedTitle: "Zapisane notatki",
    unnamedDemo: "unnamed.dem",
    drawingOne: "{count} rysunek",
    drawingOther: "{count} rysunków",
    linked: "powiązane: {label}",
    player: "Gracz",
    linkDemo: "Powiąż demo",
    linkDemoTitle: "Powiąż ten plik demo, żeby Otwórz wczytywał go bez ponownego dropu",
    deleteNotes: "Usuń",
    deleteNotesTitle: "Usuń notatki z tego meczu",
    previous: "Poprzednie",
    next: "Następne",
    unknownTime: "nieznany czas",
    restoreTitle: "Przywróć notatki",
    restoreBody: "Upuść {file}, żeby przywrócić te rysunki. Samego dema nie przechowujemy.",
    close: "Zamknij",
  },
  parse: {
    percent: "{pct}%",
    overall: "Łącznie {pct}%",
    done: "gotowe",
    error: "błąd",
    queued: "…",
  },
} satisfies Pick<Messages, "drop" | "parse">;
