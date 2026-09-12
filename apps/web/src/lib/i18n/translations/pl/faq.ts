import type { Messages } from "../../messages";

export const faq = {
  faq: {
    title: "FAQ",
    lead: "Krótkie odpowiedzi o lokalnym podglądzie GOTV. Upuść demo na stronie głównej albo otwórz Analyzer, żeby wrócić do zapisanych notatek.",
    whatIs: {
      question: "Czym jest CS2 Analyzer?",
      body: "Lokalny podgląd dem GOTV Counter-Strike 2. Upuść replay, żeby oglądać go na radarze 2D, z tablicą w stylu FACEIT, utility, clutchami, historią rund i narzędziami do rysowania.",
    },
    privacy: {
      question: "Czy moje dema opuszczają ten komputer?",
      body: "Nie. Parsowanie działa w przeglądarce (Web Worker + WASM). Plik nie jest wysyłany. Notatki i rysunki zostają w tej przeglądarce, dopóki nie wyeksportujesz kopii JSON z Ustawień.",
    },
    whatToDrop: {
      question: "Co mogę wrzucić?",
      body: "GOTV {dem} ze Source 2 — FACEIT, Premier albo matchmaking. Jeden plik otwiera mecz. Kilka plików otwiera analizę Habits (ta sama mapa albo mieszane mapy z wyborem mapy). Możesz też zaimportować kopię JSON notatek z Ustawień.",
    },
    savedNotes: {
      question: "Jak działają zapisane notatki?",
      body: "Rysunki zapisują się same w tej przeglądarce. Samego dema nie przechowujemy, więc Otwórz prosi o drop tego samego {dem} (albo podpiętego pliku), żeby je przywrócić. Wyeksportuj kopię JSON z Ustawień, żeby czyszczenie cache ich nie zjadło.",
    },
    stats: {
      question: "Jakie to statystyki?",
      intro:
        "Żywa, dokładna do ticka tablica do aktualnego playheada: K/D/A, ADR, KAST, rating, entry, kasa i podziały CT/T.",
      adrHeading: "ADR i trade'y",
      adrBody:
        "ADR to obrażenia HP wroga ograniczone do pozostałego HP. Trade'y liczą się w oknie 5 sekund.",
      sidesHeading: "Strony i overtime",
      sidesBody:
        "Zmiany stron i overtime idą za scoringiem competitive, nie surową liczbą rund CT kontra T.",
    },
    gotvOrPov: {
      question: "GOTV czy POV?",
      body: "GOTV to wspierana ścieżka. Dema POV to inne nagranie i nie pod to są zbudowane radar, HUD i statystyki.",
    },
    browsers: {
      question: "Które przeglądarki działają?",
      body: "Aktualny Chromium, Firefox albo Safari z WebAssembly i Web Workers. Podpinanie pliku demo, żeby Otwórz wczytał go bez ponownego dropu, używa File System Access API i działa tylko na Chromium.",
    },
    affiliation: {
      question: "Czy to jest powiązane z Valve albo FACEIT?",
      body: "Nie. To projekt fanowski. Radary map i ikony broni to vendored assety społeczności/Valve do użytku offline — nie rościmy sobie do nich praw.",
    },
    preRelease: {
      question: "Strona pisze pre-release — mam się martwić?",
      body: "Live site jest jeszcze w testach. Format parsera i notatek może się zmienić; zapisane notatki w tej przeglądarce mogą przestać się wczytywać po nowszej wersji. Wyeksportuj kopię JSON, jeśli rysunki są ważne.",
    },
    report: {
      question: "Jak zgłosić buga albo poprosić o funkcję?",
      body: "Otwórz issue na {issues}. Podaj mapę, czy to było jedno demo czy seria, i czego oczekiwałeś.",
      issuesLink: "GitHub Issues",
    },
  },
} satisfies Pick<Messages, "faq">;
