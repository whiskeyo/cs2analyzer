import type { ReviewHeadline, ReviewHeadlineDetail, ReviewNote } from "./review";

/** Stable key so “Won 2 openings” and “Won 3 openings” share a match pattern. */
export function headlineMatchKey(headline: ReviewHeadline): string {
  return `${headline.severity}|${headline.text.replace(/\d+/g, "#")}`;
}

/**
 * Whether a player-review note belongs under a headline (series merge + spoiler
 * details). `mergeKey` is from `headlineMatchKey`.
 */
export function noteMatchesHeadline(note: ReviewNote, mergeKey: string): boolean {
  const key = mergeKey.toLowerCase();
  const hay = `${note.title} ${note.detail}`.toLowerCase();
  if (key.includes("opening duel") && key.includes("lost")) {
    return hay.includes("opening death") || note.title.toLowerCase().startsWith("lost the opening");
  }
  if (key.includes("won") && key.includes("opening")) {
    return note.title.startsWith("Won the opening");
  }
  if (key.includes("traded") && key.includes("opener")) {
    return note.title.startsWith("Traded the opener");
  }
  if (key.includes("clutch") && key.includes("lost")) {
    return note.title.includes("1v") || hay.includes("lost 1v");
  }
  if (key.includes("clutch") && key.includes("won")) {
    return note.title.startsWith("Won a 1v");
  }
  if (key.includes("untraded")) return note.detail.includes("untraded");
  if (key.includes("flashed")) return note.detail.includes("flashed");
  if (key.includes("damage back") || key.includes("gunfight")) {
    // Low-return copy is either "no damage back" or "only N dmg back".
    return note.detail.includes("damage back") || note.detail.includes("dmg back");
  }
  if (key.includes("multi-kill") || key.includes("fed")) {
    return note.detail.includes("fed a");
  }
  if (key.includes("utility")) return note.detail.includes("died to");
  if (key.includes("nades")) return note.detail.includes("died holding");
  if (key.includes("eco round")) return note.title.includes("eco");
  // Digit normalization turns "4k+" into "#k+".
  if (key.includes("#k+") || key.includes("4k")) {
    return note.title.includes("k this round") || note.title === "Ace";
  }
  return false;
}

export function noteDetailText(note: ReviewNote): string {
  return note.detail ? `${note.title} · ${note.detail}` : note.title;
}

/** Fill spoiler rows from notes when a headline has no details yet (player review). */
export function attachHeadlineDetails(
  headlines: ReviewHeadline[],
  notes: readonly ReviewNote[],
): ReviewHeadline[] {
  return headlines.map((headline) => {
    if (headline.details != null && headline.details.length > 0) return headline;
    const key = headlineMatchKey(headline);
    const details: ReviewHeadlineDetail[] = notes
      .filter((note) => noteMatchesHeadline(note, key))
      .map((note) => ({
        tick: note.tick,
        roundLabel: note.roundLabel,
        text: noteDetailText(note),
      }));
    return details.length > 0 ? { ...headline, details } : headline;
  });
}

/** Notes that are not covered by any headline spoiler. */
export function notesOutsideHeadlines(
  headlines: readonly ReviewHeadline[],
  notes: readonly ReviewNote[],
): ReviewNote[] {
  return notes.filter(
    (note) => !headlines.some((headline) => noteMatchesHeadline(note, headlineMatchKey(headline))),
  );
}
