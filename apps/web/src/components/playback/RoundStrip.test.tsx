import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_TICK_RATE } from "@/lib/shared/constants";
import { makeReplay, makeRound } from "@/lib/testing/fixtures";
import { setPlaybackCommandSink } from "@/lib/playback/playbackCommands";
import { jumpToRound } from "@/lib/playback/roundAutoplay";
import { RoundStrip } from "./RoundStrip";

const tps = DEFAULT_TICK_RATE;

describe("RoundStrip", () => {
  beforeEach(() => {
    setPlaybackCommandSink(null);
  });

  it("lists every round and marks the live one", async () => {
    const replay = makeReplay({
      rounds: [
        makeRound({ number: 0, is_knife: true, start_tick: 0, end_tick: 100 }),
        makeRound({ number: 1, start_tick: 200, freeze_end_tick: 264, end_tick: 900 }),
        makeRound({ number: 2, start_tick: 1000, freeze_end_tick: 1064, end_tick: 1600 }),
      ],
    });
    render(<RoundStrip replay={replay} tick={300} strokes={[]} places={null} />);

    await waitFor(() => expect(screen.getByRole("list")).toBeInTheDocument());
    expect(screen.getByTitle("Knife")).toHaveTextContent("K");
    expect(screen.getByTitle("Round 1")).toHaveClass("on");
    expect(screen.getByTitle("Round 2")).not.toHaveClass("on");
  });

  it("keeps the pinned round highlighted when the tick is still in the previous round", async () => {
    const replay = makeReplay({
      rounds: [
        makeRound({ number: 18, start_tick: 6000, freeze_end_tick: 7064, end_tick: 8900 }),
        makeRound({ number: 19, start_tick: 7000, freeze_end_tick: 9064, end_tick: 9900 }),
      ],
    });
    render(
      <RoundStrip
        replay={replay}
        tick={6999}
        strokes={[]}
        places={null}
        activeRound={replay.rounds[1]}
      />,
    );

    await waitFor(() => expect(screen.getByTitle("Round 19")).toHaveClass("on"));
    expect(screen.getByTitle("Round 18")).not.toHaveClass("on");
  });

  it("dispatches a jump command when a round chip is clicked", async () => {
    const onJump = vi.fn();
    setPlaybackCommandSink((cmd) => {
      if (cmd.type === "jump" && cmd.round) onJump(jumpToRound(replay, cmd.round));
    });
    const replay = makeReplay({
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 2 * tps, end_tick: 640 })],
    });
    render(<RoundStrip replay={replay} tick={tps} strokes={[]} places={null} />);

    await userEvent.click(screen.getByTitle("Round 1"));
    expect(onJump).toHaveBeenCalledWith(2 * tps);
  });

  it("flags rounds that have note strokes", async () => {
    const replay = makeReplay({
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
    });
    render(
      <RoundStrip
        replay={replay}
        tick={100}
        strokes={[{ type: "pen", round: 1, color: "#fff", points: [{ x: 0, y: 0 }] }]}
        places={null}
      />,
    );

    await waitFor(() => expect(screen.getByTitle("Round 1 · notes")).toHaveClass("has-notes"));
  });
});
