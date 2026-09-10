import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyNote, groupItems, notesByRound } from "@/lib/notes";
import { makeReplay, makeRound } from "@/lib/testing/fixtures";
import type { Note, RoundNote } from "@/lib/notes/types";
import { NoteRoundList } from "./NoteRoundList";

const pen = { type: "pen" as const, color: "#fff", points: [{ x: 0, y: 0 }] };

function row(note: Note, round = 1): RoundNote[] {
  return notesByRound([{ round, note }]);
}

function noopDrag(overrides: Record<string, unknown> = {}) {
  return {
    selected: [],
    dragging: null,
    dropOn: null,
    skipClick: { current: false },
    tps: 64,
    toggle: vi.fn(),
    toggleAll: vi.fn(),
    startDrag: vi.fn(),
    markDrag: vi.fn(),
    endDrag: vi.fn(),
    dropAt: vi.fn(),
    allowDrop: vi.fn(),
    setEdge: vi.fn(),
    setClock: vi.fn(),
    clearWindow: vi.fn(),
    ...overrides,
  };
}

describe("NoteRoundList", () => {
  it("renders rounds with note items", () => {
    const rounds = row({
      ...emptyNote(),
      drawings: [pen],
      bookmarks: [{ color: "#fff", text: "Peek", tick: 100 }],
    });
    const replay = makeReplay({
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
    });
    render(
      <NoteRoundList
        replay={replay}
        rounds={rounds}
        onJump={() => {}}
        onNotes={() => {}}
        {...noopDrag()}
      />,
    );
    expect(screen.getByText("Round 1")).toBeInTheDocument();
    expect(screen.getByText("Peek")).toBeInTheDocument();
  });

  it("offers squash when multiple loose drawings exist", async () => {
    const onNotes = vi.fn();
    const replay = makeReplay({
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
    });
    render(
      <NoteRoundList
        replay={replay}
        rounds={row({ ...emptyNote(), drawings: [pen, { ...pen }] })}
        onJump={() => {}}
        onNotes={onNotes}
        {...noopDrag()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Squash drawings" }));
    expect(onNotes).toHaveBeenCalled();
  });

  it("labels knife rounds and jumps from a note row", async () => {
    const onJump = vi.fn();
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 0,
          is_knife: true,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
      ],
    });
    render(
      <NoteRoundList
        replay={replay}
        rounds={row({ ...emptyNote(), drawings: [pen] }, 0)}
        onJump={onJump}
        onNotes={() => {}}
        {...noopDrag()}
      />,
    );
    expect(screen.getByText("Knife")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Pen" }));
    expect(onJump).toHaveBeenCalled();
  });

  it("toggles group visibility and fold state", async () => {
    const grouped = groupItems({ ...emptyNote(), drawings: [pen, { ...pen }] }, [
      { kind: "loose", index: 0 },
      { kind: "loose", index: 1 },
    ]);
    const onNotes = vi.fn();
    const replay = makeReplay({
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
    });
    const toggleAll = vi.fn();
    render(
      <NoteRoundList
        replay={replay}
        rounds={row(grouped)}
        onJump={() => {}}
        onNotes={onNotes}
        {...noopDrag({
          selected: [
            { round: 1, ref: { kind: "group", groupIndex: 0, drawingIndex: 0 } },
            { round: 1, ref: { kind: "group", groupIndex: 0, drawingIndex: 1 } },
          ],
          toggleAll,
        })}
      />,
    );
    await userEvent.click(screen.getByLabelText(`Select ${grouped.groups[0]?.name}`));
    expect(toggleAll).toHaveBeenCalled();

    await userEvent.click(screen.getByLabelText("Hide layer on radar"));
    expect(onNotes).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Show layer members" }));
    expect(screen.getAllByLabelText("Select Pen").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Hide layer members" }));
    expect(screen.queryByLabelText("Select Pen")).not.toBeInTheDocument();
  });

  it("shows drop slots while dragging in the same round", () => {
    const grouped = groupItems({ ...emptyNote(), drawings: [pen, { ...pen }] }, [
      { kind: "loose", index: 0 },
      { kind: "loose", index: 1 },
    ]);
    const replay = makeReplay({
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
    });
    const rounds = row(grouped);
    const { rerender } = render(
      <NoteRoundList
        replay={replay}
        rounds={rounds}
        onJump={() => {}}
        onNotes={() => {}}
        {...noopDrag()}
      />,
    );
    expect(screen.queryByText("Drop at top to ungroup")).not.toBeInTheDocument();

    rerender(
      <NoteRoundList
        replay={replay}
        rounds={rounds}
        onJump={() => {}}
        onNotes={() => {}}
        {...noopDrag({
          dragging: {
            round: 1,
            refs: [
              { kind: "group", groupIndex: 0, drawingIndex: 0 },
              { kind: "group", groupIndex: 0, drawingIndex: 1 },
            ],
          },
        })}
      />,
    );
    expect(screen.getByText("Drop at top to ungroup")).toBeInTheDocument();
    expect(screen.getByText("Drop at bottom to make a new group")).toBeInTheDocument();
  });

  it("removes a bookmark and hides a loose note", async () => {
    const onNotes = vi.fn();
    const replay = makeReplay({
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
    });
    render(
      <NoteRoundList
        replay={replay}
        rounds={row({
          ...emptyNote(),
          drawings: [{ type: "text", color: "#fff", x: 0, y: 0, text: "Callout" }],
          bookmarks: [{ color: "#fff", text: "Save", tick: 100 }],
        })}
        onJump={() => {}}
        onNotes={onNotes}
        {...noopDrag()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Remove bookmark" }));
    expect(onNotes).toHaveBeenCalled();

    await userEvent.click(screen.getAllByLabelText("Hide on radar")[0]);
    expect(onNotes).toHaveBeenCalledTimes(2);
  });

  it("skips jump clicks after a drag", () => {
    const onJump = vi.fn();
    const skipClick = { current: true };
    const replay = makeReplay({
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
    });
    render(
      <NoteRoundList
        replay={replay}
        rounds={row({ ...emptyNote(), drawings: [pen] })}
        onJump={onJump}
        onNotes={() => {}}
        {...noopDrag({ skipClick })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pen" }));
    expect(onJump).not.toHaveBeenCalled();
    expect(skipClick.current).toBe(false);
  });
});
