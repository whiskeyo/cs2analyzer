import { describe, expect, it } from "vitest";
import type { ReviewHeadline, ReviewNote } from "./review";
import {
  attachHeadlineDetails,
  headlineMatchKey,
  noteMatchesHeadline,
  notesOutsideHeadlines,
} from "./reviewHeadlineMatch";

function note(partial: Partial<ReviewNote> & Pick<ReviewNote, "title">): ReviewNote {
  return {
    tick: 100,
    roundLabel: "R1",
    detail: "",
    severity: "high",
    kind: "death",
    ...partial,
  };
}

describe("reviewHeadlineMatch", () => {
  it("matches opening wins and losses", () => {
    const wonKey = headlineMatchKey({
      text: "Won 2 opening duels",
      severity: "good",
      count: 2,
      kind: "opening",
    });
    expect(
      noteMatchesHeadline(note({ title: "Won the opening vs Bob", kind: "opening" }), wonKey),
    ).toBe(true);
    const lostKey = headlineMatchKey({
      text: "Lost 1 opening duel",
      severity: "high",
      count: 1,
      kind: "opening",
    });
    expect(
      noteMatchesHeadline(
        note({ title: "Lost the opening to Bob", detail: "opening death", kind: "opening" }),
        lostKey,
      ),
    ).toBe(true);
    expect(
      noteMatchesHeadline(note({ title: "Won the opening vs Bob", kind: "opening" }), lostKey),
    ).toBe(false);
  });

  it("attaches details to headlines that lack them", () => {
    const headlines: ReviewHeadline[] = [
      { text: "Won 1 opening duel", severity: "good", count: 1, kind: "opening" },
    ];
    const notes = [
      note({
        tick: 200,
        roundLabel: "R3",
        title: "Won the opening vs Bob",
        detail: "AK-47",
        severity: "good",
        kind: "opening",
      }),
    ];
    expect(attachHeadlineDetails(headlines, notes)[0]?.details).toEqual([
      {
        tick: 200,
        roundLabel: "R3",
        text: "Won the opening vs Bob · AK-47",
      },
    ]);
  });

  it("leaves existing details alone", () => {
    const headlines: ReviewHeadline[] = [
      {
        text: "Lost 1 anti-eco round",
        severity: "high",
        count: 1,
        kind: "eco",
        details: [{ tick: 1, roundLabel: "R4", text: "Lost an anti-eco vs Eco" }],
      },
    ];
    expect(attachHeadlineDetails(headlines, [])[0]?.details).toHaveLength(1);
  });

  it("lists low-return and multi-kill notes under their headlines", () => {
    const gunfightKey = headlineMatchKey({
      text: "2 gunfights with almost no damage back",
      severity: "mid",
      count: 2,
      kind: "death",
    });
    expect(
      noteMatchesHeadline(
        note({ title: "Died to Bob", detail: "AK-47 · only 10 dmg back" }),
        gunfightKey,
      ),
    ).toBe(true);
    expect(
      noteMatchesHeadline(
        note({ title: "Died to Bob", detail: "AK-47 · no damage back" }),
        gunfightKey,
      ),
    ).toBe(true);

    const multiKey = headlineMatchKey({
      text: "1 round with 4k+",
      severity: "good",
      count: 1,
      kind: "multi",
    });
    expect(noteMatchesHeadline(note({ title: "4k this round", kind: "multi" }), multiKey)).toBe(
      true,
    );
    expect(noteMatchesHeadline(note({ title: "Ace", kind: "multi" }), multiKey)).toBe(true);
  });

  it("lists notes that no headline claims", () => {
    const headlines: ReviewHeadline[] = [
      { text: "Won 1 opening duel", severity: "good", count: 1, kind: "opening" },
    ];
    const orphan = note({ title: "Died to Bob", detail: "AK-47", kind: "death" });
    const matched = note({
      title: "Won the opening vs Bob",
      severity: "good",
      kind: "opening",
    });
    expect(notesOutsideHeadlines(headlines, [orphan, matched])).toEqual([orphan]);
  });
});
