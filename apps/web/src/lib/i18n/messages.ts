/**
 * Chrome strings for the shared dialog and the radar overlays.
 * English is the live catalog. Polish keeps the same keys so a locale switch
 * can read `pl` without a missing label.
 */
export interface ChromeMessages {
  dialog: { close: string };
  timeline: { open: string };
  layers: {
    heading: string;
    hint: string;
    grenades: string;
    shots: string;
    deaths: string;
    openings: string;
    names: string;
    cone: string;
    heatmap: string;
    summary: string;
  };
}

export const en = {
  dialog: { close: "Close" },
  timeline: { open: "Stats timeline" },
  layers: {
    heading: "Radar overlays",
    hint: "This demo only. Defaults for the next demo stay under Default layers.",
    grenades: "Nades",
    shots: "Shots",
    deaths: "Deaths",
    openings: "FK",
    names: "Names",
    cone: "Cone",
    heatmap: "Heat",
    summary: "Summary",
  },
} satisfies ChromeMessages;

export const pl = {
  dialog: { close: "Zamknij" },
  timeline: { open: "Oś statystyk" },
  layers: {
    heading: "Nakładki radaru",
    hint: "Tylko ta demo. Domyślne na następną demo zostają w Domyślne warstwy.",
    grenades: "Nades",
    shots: "Strzały",
    deaths: "Zgony",
    openings: "FK",
    names: "Nicki",
    cone: "Cone",
    heatmap: "Heat",
    summary: "Summary",
  },
} satisfies ChromeMessages;

/** Live UI copy. Locale selection is still English until the settings switch lands. */
export function useMessages(): ChromeMessages {
  return en;
}
