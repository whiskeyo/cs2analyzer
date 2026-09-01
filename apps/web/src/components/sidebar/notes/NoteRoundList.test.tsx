import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { groupStrokes, notesByRound } from "@/lib/notes";
import { makeReplay, makeRound } from "@/lib/testing/fixtures";
import type { Stroke } from "@/lib/notes/types";
import { NoteRoundList } from "./NoteRoundList";

function pen(round = 1): Stroke {
  return { type: "pen", round, color: "#fff", points: [{ x: 0, y: 0 }] };
}

function noopDrag(overrides: Record<string, unknown> = {}) {
  return {
    selected: [] as number[],
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
    const strokes: Stroke[] = [pen(), { type: "bookmark", round: 1, color: "#fff", text: "Peek" }];
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
      ],
    });
    const rounds = notesByRound(strokes);
    render(
      <NoteRoundList
        replay={replay}
        rounds={rounds}
        strokes={strokes}
        onJump={() => {}}
        onStrokes={() => {}}
        {...noopDrag()}
      />,
    );
    expect(screen.getByText("Round 1")).toBeInTheDocument();
    expect(screen.getByText("Peek")).toBeInTheDocument();
  });

  it("offers squash when multiple loose drawings exist", async () => {
    const strokes = [pen(), pen()];
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
      ],
    });
    const onStrokes = vi.fn();
    render(
      <NoteRoundList
        replay={replay}
        rounds={notesByRound(strokes)}
        strokes={strokes}
        onJump={() => {}}
        onStrokes={onStrokes}
        {...noopDrag()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Squash drawings" }));
    expect(onStrokes).toHaveBeenCalled();
  });

  it("labels knife rounds and jumps from a note row", async () => {
    const strokes = [pen()];
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
        rounds={notesByRound(strokes.map((s) => ({ ...s, round: 0 })))}
        strokes={strokes.map((s) => ({ ...s, round: 0 }))}
        onJump={onJump}
        onStrokes={() => {}}
        {...noopDrag()}
      />,
    );
    expect(screen.getByText("Knife")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Pen" }));
    expect(onJump).toHaveBeenCalled();
  });

  it("toggles group visibility and fold state", async () => {
    const strokes = groupStrokes([pen(), pen()], [0, 1]);
    const groupId = strokes[0].group ?? "";
    const onStrokes = vi.fn();
    const replay = makeReplay({
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
    });
    const toggleAll = vi.fn();
    render(
      <NoteRoundList
        replay={replay}
        rounds={notesByRound(strokes)}
        strokes={strokes}
        onJump={() => {}}
        onStrokes={onStrokes}
        {...noopDrag({ selected: [0, 1], toggleAll })}
      />,
    );
    await userEvent.click(screen.getByLabelText(`Select ${groupId}`));
    expect(toggleAll).toHaveBeenCalledWith([0, 1]);

    await userEvent.click(screen.getByLabelText("Hide layer on radar"));
    expect(onStrokes).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Show layer members" }));
    expect(screen.getAllByLabelText("Select Pen").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Hide layer members" }));
    expect(screen.queryByLabelText("Select Pen")).not.toBeInTheDocument();
  });

  it("shows drop slots while dragging in the same round", () => {
    const strokes = groupStrokes([pen(), pen()], [0, 1]);
    const replay = makeReplay({
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
    });
    const { rerender } = render(
      <NoteRoundList
        replay={replay}
        rounds={notesByRound(strokes)}
        strokes={strokes}
        onJump={() => {}}
        onStrokes={() => {}}
        {...noopDrag()}
      />,
    );
    expect(screen.queryByText("Drop at top to ungroup")).not.toBeInTheDocument();

    rerender(
      <NoteRoundList
        replay={replay}
        rounds={notesByRound(strokes)}
        strokes={strokes}
        onJump={() => {}}
        onStrokes={() => {}}
        {...noopDrag({ dragging: { round: 1, indexes: [0, 1] } })}
      />,
    );
    expect(screen.getByText("Drop at top to ungroup")).toBeInTheDocument();
    expect(screen.getByText("Drop at bottom to make a new group")).toBeInTheDocument();
  });

  it("removes a bookmark and hides a loose note", async () => {
    const strokes: Stroke[] = [
      { type: "bookmark", round: 1, color: "#fff", text: "Save" },
      { type: "text", round: 1, color: "#fff", x: 0, y: 0, text: "Callout" },
    ];
    const onStrokes = vi.fn();
    const replay = makeReplay({
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
    });
    render(
      <NoteRoundList
        replay={replay}
        rounds={notesByRound(strokes)}
        strokes={strokes}
        onJump={() => {}}
        onStrokes={onStrokes}
        {...noopDrag()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Remove bookmark" }));
    expect(onStrokes).toHaveBeenCalled();

    await userEvent.click(screen.getAllByLabelText("Hide on radar")[0]);
    expect(onStrokes).toHaveBeenCalledTimes(2);
  });

  it("skips jump clicks after a drag", () => {
    const strokes = [pen()];
    const onJump = vi.fn();
    const skipClick = { current: true };
    const replay = makeReplay({
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
    });
    render(
      <NoteRoundList
        replay={replay}
        rounds={notesByRound(strokes)}
        strokes={strokes}
        onJump={onJump}
        onStrokes={() => {}}
        {...noopDrag({ skipClick })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pen" }));
    expect(onJump).not.toHaveBeenCalled();
    expect(skipClick.current).toBe(false);
  });
});
