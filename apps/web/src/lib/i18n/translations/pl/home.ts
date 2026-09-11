import type { Messages } from "../../messages";

export const home = {
  home: {
    kicker: "Lokalny podgląd GOTV",
    title: "Oglądaj dema Counter-Strike 2 na radarze 2D",
    lead: "Upuść replay i analizuj na tym komputerze. Parsowanie, odtwarzanie, statystyki i rysunki działają w przeglądarce.",
    featureRadar: "Live radar, nades, tracking i rysowanie.",
    featureScoreboard: "Tablica w stylu FACEIT, clutche, utility i historia rund.",
    featureHabits: "Tryb Habits: kilka dem, ta sama mapa albo mieszane mapy.",
    featureKillfeed: "Killfeed, opening duels, podsumowanie nades i eksport CSV.",
    featureMore: "I dużo więcej!",
    faqHint: "Jeśli masz pytania, {faqLink}.",
    faqLink: "zobacz FAQ",
  },
  faq: {
    title: "FAQ",
    lead: "Krótkie odpowiedzi o lokalnym podglądzie GOTV. Upuść demo na stronie głównej albo otwórz Analyzer, żeby wrócić do zapisanych notatek.",
  },
} satisfies Pick<Messages, "home" | "faq">;
