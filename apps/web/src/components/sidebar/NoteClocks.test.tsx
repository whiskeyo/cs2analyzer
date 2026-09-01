import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_TICK_RATE } from "@/lib/shared/constants";
import { makeReplay, makeRound } from "@/lib/testing/fixtures";
import { MomentInOut, roundWindowEnd } from "./NoteClocks";

describe("roundWindowEnd", () => {
  it("uses the next round start as the scrub max", () => {
    const replay = makeReplay({
      rounds: [
        makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 500 }),
        makeRound({ number: 2, start_tick: 600, freeze_end_tick: 664, end_tick: 1200 }),
      ],
    });
    expect(roundWindowEnd(replay.rounds[0], replay)).toBe(599);
  });
});

describe("MomentInOut", () => {
  const round = makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 });
  const tps = DEFAULT_TICK_RATE;

  it("renders start and end clocks", () => {
    render(
      <MomentInOut
        win={{ start: 64, end: 200 }}
        round={round}
        tps={tps}
        roundEndTick={640}
        onSetEdge={vi.fn()}
        onClear={vi.fn()}
        onClockEdge={vi.fn()}
      />,
    );
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("End")).toBeInTheDocument();
  });

  it("nudges the start edge and clears the window", async () => {
    const onClockEdge = vi.fn();
    const onClear = vi.fn();
    render(
      <MomentInOut
        win={{ start: 64, end: 200 }}
        round={round}
        tps={tps}
        roundEndTick={640}
        onSetEdge={vi.fn()}
        onClear={onClear}
        onClockEdge={onClockEdge}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Start later" }));
    expect(onClockEdge).toHaveBeenCalledWith("start", 1);

    await userEvent.click(screen.getByTitle("Show for the whole round"));
    expect(onClear).toHaveBeenCalled();
  });

  it("nudges the end edge and pins the start", async () => {
    const onSetEdge = vi.fn();
    const onClockEdge = vi.fn();
    render(
      <MomentInOut
        win={{ start: 64, end: 200 }}
        round={round}
        tps={tps}
        roundEndTick={640}
        onSetEdge={onSetEdge}
        onClear={vi.fn()}
        onClockEdge={onClockEdge}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "End earlier" }));
    expect(onClockEdge).toHaveBeenCalledWith("end", expect.any(Number));

    await userEvent.dblClick(screen.getAllByTitle(/double-click sets the playhead/)[0]!);
    expect(onSetEdge).toHaveBeenCalledWith("start");
  });
});
