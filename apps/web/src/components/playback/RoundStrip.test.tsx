import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DEFAULT_TICK_RATE,
  ECO_MAX_EQUIPMENT,
  FIRST_OVERTIME_ROUND,
  FORCE_BUY_MAX_EQUIPMENT,
} from "@/lib/shared/constants";
import { makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";
import { PlaybackCommandProvider } from "@/lib/playback/playbackCommandContext";
import { createPlaybackCommandBus, setPlaybackCommandSink } from "@/lib/playback/playbackCommands";
import { usePlaybackCommandSink } from "@/lib/playback/usePlaybackCommandSink";
import { jumpToRound } from "@/lib/playback/roundAutoplay";
import {
  FLAG_ALIVE,
  FLAG_CT,
  FLAG_PRESENT,
  type Replay,
  type Round,
} from "@/lib/replay/replayTypes";
import { RoundStrip } from "./RoundStrip";

const tps = DEFAULT_TICK_RATE;

function CommandSink({
  replay,
  tick,
  jump,
}: {
  replay: Replay;
  tick: number;
  jump: (t: number, pause?: boolean, round?: Round | null) => void;
}) {
  usePlaybackCommandSink({
    replayRef: { current: replay },
    tickRef: { current: tick },
    selectedRef: { current: null },
    placesRef: { current: null },
    jump,
    undo: vi.fn(),
    redo: vi.fn(),
    togglePlaying: vi.fn(),
    setFollow: vi.fn(),
    setTrails: vi.fn(),
    setSelected: vi.fn(),
  });
  return null;
}

describe("RoundStrip", () => {
  beforeEach(() => {
    setPlaybackCommandSink(null);
  });

  it("lists every round and marks the live one", async () => {
    const replay = makeReplay({
      rounds: [
        makeRound({ number: 0, is_knife: true, start_tick: 0, end_tick: 100 }),
        makeRound({
          number: 1,
          start_tick: 200,
          freeze_end_tick: 264,
          end_tick: 900,
        }),
        makeRound({
          number: 2,
          start_tick: 1000,
          freeze_end_tick: 1064,
          end_tick: 1600,
        }),
      ],
    });
    render(<RoundStrip replay={replay} tick={300} notes={[]} places={null} />);

    await waitFor(() => expect(screen.getByRole("list")).toBeInTheDocument());
    expect(screen.getByTitle("Knife")).toHaveTextContent("K");
    expect(screen.getByTitle("Round 1 · Pistol")).toHaveClass("on");
    expect(
      screen.getByTitle("Round 1 · Pistol").querySelector("img")?.getAttribute("src"),
    ).toContain("glock.svg");
    expect(screen.getByTitle("Round 2")).not.toHaveClass("on");
  });

  it("keeps the pinned round highlighted when the tick is still in the previous round", async () => {
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 18,
          start_tick: 6000,
          freeze_end_tick: 7064,
          end_tick: 8900,
        }),
        makeRound({
          number: 19,
          start_tick: 7000,
          freeze_end_tick: 9064,
          end_tick: 9900,
        }),
      ],
    });
    render(
      <RoundStrip
        replay={replay}
        tick={6999}
        notes={[]}
        places={null}
        activeRound={replay.rounds[1]}
      />,
    );

    await waitFor(() => expect(screen.getByTitle("Round 19")).toHaveClass("on"));
    expect(screen.getByTitle("Round 18")).not.toHaveClass("on");
  });

  it("dispatches a jump command when a round chip is clicked", async () => {
    const onJump = vi.fn();
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          freeze_end_tick: 2 * tps,
          end_tick: 640,
        }),
      ],
    });
    setPlaybackCommandSink((cmd) => {
      if (cmd.type === "jump" && cmd.round) onJump(jumpToRound(replay, cmd.round));
    });
    render(<RoundStrip replay={replay} tick={tps} notes={[]} places={null} />);

    await userEvent.click(screen.getByTitle("Round 1 · Pistol").querySelector("img")!);
    expect(onJump).toHaveBeenCalledWith(2 * tps);
  });

  it("seeks through the analyzer command bus when a chip is clicked", async () => {
    const onJump = vi.fn();
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          freeze_end_tick: 2 * tps,
          end_tick: 640,
        }),
        makeRound({
          number: 2,
          start_tick: 21 * tps,
          freeze_end_tick: 23 * tps,
          end_tick: 40 * tps,
        }),
      ],
    });
    const bus = createPlaybackCommandBus();
    render(
      <PlaybackCommandProvider bus={bus}>
        <CommandSink replay={replay} tick={tps} jump={onJump} />
        <RoundStrip replay={replay} tick={tps} notes={[]} places={null} />
      </PlaybackCommandProvider>,
    );

    await userEvent.click(screen.getByTitle("Round 2"));
    expect(onJump).toHaveBeenCalledWith(0, true, expect.objectContaining({ number: 2 }));
  });

  it("flags rounds that have note strokes", async () => {
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
    render(
      <RoundStrip
        replay={replay}
        tick={100}
        notes={[
          {
            round: 1,
            note: {
              groups: [],
              drawings: [{ type: "pen", color: "#fff", points: [{ x: 0, y: 0 }] }],
              pieces: [],
              bookmarks: [],
            },
          },
        ]}
        places={null}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTitle("Round 1 · Pistol · notes")).toHaveClass("has-notes"),
    );
  });

  it("greys and disables rounds the tutorial series marks inactive", async () => {
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
        }),
        makeRound({
          number: 3,
          start_tick: 700,
          freeze_end_tick: 764,
          end_tick: 1200,
        }),
      ],
    });
    const onJump = vi.fn();
    setPlaybackCommandSink((cmd) => {
      if (cmd.type === "jump") onJump(cmd.round?.number);
    });
    render(
      <RoundStrip
        replay={replay}
        tick={100}
        notes={[]}
        places={null}
        roundEnabled={(round) => round.number === 1}
      />,
    );

    await waitFor(() => expect(screen.getByTitle("Round 1 · Pistol")).toBeEnabled());
    const inactive = screen.getByTitle("Round 3 · not playable in the tutorial");
    expect(inactive).toBeDisabled();
    expect(inactive).toHaveClass("is-inactive");
    await userEvent.click(inactive);
    expect(onJump).not.toHaveBeenCalled();
  });

  it("shows eco and overtime icons from freeze equipment", async () => {
    const present = FLAG_PRESENT | FLAG_ALIVE;
    const ticks = makeTicks(2, 2);
    ticks.ticks[0] = 64;
    ticks.ticks[1] = 2000;
    ticks.flags[0] = present | FLAG_CT;
    ticks.flags[1] = present;
    ticks.flags[2] = present | FLAG_CT;
    ticks.flags[3] = present;
    ticks.equip[0] = FORCE_BUY_MAX_EQUIPMENT;
    ticks.equip[1] = ECO_MAX_EQUIPMENT - 1;
    ticks.equip[2] = FORCE_BUY_MAX_EQUIPMENT;
    ticks.equip[3] = FORCE_BUY_MAX_EQUIPMENT;
    const replay = makeReplay({
      ticks,
      rounds: [
        makeRound({
          number: 4,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 400,
        }),
        makeRound({
          number: FIRST_OVERTIME_ROUND,
          start_tick: 1900,
          freeze_end_tick: 2000,
          end_tick: 2800,
        }),
      ],
    });

    render(<RoundStrip replay={replay} tick={100} notes={[]} places={null} />);

    await waitFor(() =>
      expect(screen.getByTitle("Round 4 · Eco")).toHaveAttribute("data-chapter", "eco"),
    );
    expect(screen.getByTitle(`Round ${FIRST_OVERTIME_ROUND} · Overtime`)).toHaveAttribute(
      "data-chapter",
      "overtime",
    );
    expect(screen.getByTitle(`Round ${FIRST_OVERTIME_ROUND} · Overtime`)).toHaveTextContent("OT");
  });
});
