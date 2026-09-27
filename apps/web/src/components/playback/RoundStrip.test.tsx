import "fake-indexeddb/auto";
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
import { messagesFor } from "@/lib/i18n/catalogs";
import { roundSideBuys } from "@/lib/match/economy";
import { UserSettingsProvider } from "@/lib/settings/useUserSettings";
import { clearUserSettingsForTests, saveUserSettings } from "@/lib/settings/userSettingsStore";
import { RoundStrip, roundChipLabel } from "./RoundStrip";

const tps = DEFAULT_TICK_RATE;
const NO_BUY = "T no buy · CT no buy";

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
    expect(screen.getByTitle("Knife").querySelector(".round-buys.is-knife")).toBeTruthy();
    const live = screen.getByTitle(`Round 1 · ${NO_BUY}`);
    expect(live).toHaveClass("on");
    expect(live).toHaveAccessibleName(`Round 1 · ${NO_BUY}`);
    expect(screen.getByTitle(`Round 2 · ${NO_BUY}`)).not.toHaveClass("on");
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

    await waitFor(() => expect(screen.getByTitle(`Round 19 · ${NO_BUY}`)).toHaveClass("on"));
    expect(screen.getByTitle(`Round 18 · ${NO_BUY}`)).not.toHaveClass("on");
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

    const chip = screen.getByTitle(`Round 1 · ${NO_BUY}`);
    await userEvent.click(chip.querySelector(".round-buy.ct")!);
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

    await userEvent.click(screen.getByTitle(`Round 2 · ${NO_BUY}`));
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
      expect(screen.getByTitle(`Round 1 · ${NO_BUY} · notes`)).toHaveClass("has-notes"),
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

    await waitFor(() => expect(screen.getByTitle(`Round 1 · ${NO_BUY}`)).toBeEnabled());
    const inactive = screen.getByTitle(`Round 3 · ${NO_BUY} · not playable in the tutorial`);
    expect(inactive).toBeDisabled();
    expect(inactive).toHaveClass("is-inactive");
    await userEvent.click(inactive);
    expect(onJump).not.toHaveBeenCalled();
  });

  it("shows each side's buy, with the chip color still the round winner", async () => {
    const present = FLAG_PRESENT | FLAG_ALIVE;
    const ticks = makeTicks(2, 3);
    ticks.ticks[0] = 64;
    ticks.ticks[1] = 800;
    ticks.ticks[2] = 2000;
    const ct = present | FLAG_CT;
    ticks.flags.set([ct, present, ct, present, ct, present]);
    ticks.equip[0] = 800;
    ticks.equip[1] = 800;
    ticks.equip[2] = FORCE_BUY_MAX_EQUIPMENT;
    ticks.equip[3] = ECO_MAX_EQUIPMENT - 1;
    ticks.equip[4] = FORCE_BUY_MAX_EQUIPMENT;
    ticks.equip[5] = FORCE_BUY_MAX_EQUIPMENT;
    const replay = makeReplay({
      ticks,
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 700,
          winner: "CT",
        }),
        makeRound({
          number: 4,
          start_tick: 700,
          freeze_end_tick: 800,
          end_tick: 1800,
          winner: "T",
        }),
        makeRound({
          number: FIRST_OVERTIME_ROUND,
          start_tick: 1900,
          freeze_end_tick: 2000,
          end_tick: 2800,
          winner: "CT",
        }),
      ],
    });

    render(<RoundStrip replay={replay} tick={100} notes={[]} places={null} />);

    const pistol = await screen.findByTitle("Round 1 · T pistol · CT pistol");
    const pistolMarks = pistol.querySelectorAll(".round-buy");
    expect(pistolMarks[0]).toHaveClass("t");
    expect(pistolMarks[0]).toHaveAttribute("data-buy", "pistol");
    expect(pistolMarks[1]).toHaveClass("ct");
    expect(pistolMarks[1]).toHaveAttribute("data-buy", "pistol");
    expect(pistol).toHaveClass("ct");

    const save = screen.getByTitle("Round 4 · T eco · CT anti-eco");
    expect(save).toHaveClass("t");
    expect(save).not.toHaveClass("ct");
    expect(save.querySelector(".round-buy.ct")).toHaveAttribute("data-buy", "anti-eco");
    expect(save.querySelector(".round-buy.t")).toHaveAttribute("data-buy", "eco");

    const overtime = screen.getByTitle(`Round ${FIRST_OVERTIME_ROUND} · T full · CT full`);
    expect(overtime.querySelector(".round-buy.ct")).toHaveAttribute("data-buy", "full");
    expect(overtime.querySelector(".round-buy.t")).toHaveAttribute("data-buy", "full");
    expect(overtime).not.toHaveTextContent("OT");
  });

  it("names each side from that round, including after the half swap", async () => {
    const present = FLAG_PRESENT | FLAG_ALIVE;
    const ticks = makeTicks(2, 2);
    ticks.ticks[0] = 64;
    ticks.ticks[1] = 800;
    const ct = present | FLAG_CT;
    ticks.flags.set([ct, present, ct, present]);
    ticks.equip[0] = ECO_MAX_EQUIPMENT - 1;
    ticks.equip[1] = FORCE_BUY_MAX_EQUIPMENT;
    ticks.equip[2] = FORCE_BUY_MAX_EQUIPMENT;
    ticks.equip[3] = ECO_MAX_EQUIPMENT - 1;
    const replay = makeReplay({
      header: { team_ct: "Astralis", team_t: "Vitality" },
      ticks,
      rounds: [
        makeRound({
          number: 2,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 700,
          winner: "T",
          team_ct: "Astralis",
          team_t: "Vitality",
        }),
        makeRound({
          number: 13,
          start_tick: 700,
          freeze_end_tick: 800,
          end_tick: 1800,
          winner: "CT",
          team_ct: "Vitality",
          team_t: "Astralis",
        }),
      ],
    });

    render(<RoundStrip replay={replay} tick={100} notes={[]} places={null} />);

    expect(
      await screen.findByTitle("Round 2 · T Vitality anti-eco · CT Astralis eco"),
    ).toBeInTheDocument();
    expect(
      screen.getByTitle("Round 13 · T Astralis pistol · CT Vitality pistol"),
    ).toBeInTheDocument();
  });

  it("announces the same buy line to screen readers in Polish", async () => {
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 2,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
          team_t: "Vitality",
          team_ct: "Astralis",
        }),
      ],
    });
    const round = replay.rounds[0]!;
    const polish = roundChipLabel(
      messagesFor("pl"),
      replay,
      round,
      roundSideBuys(replay, round),
      false,
      true,
    );
    expect(polish).toBe("Runda 2 · T Vitality brak buy · CT Astralis brak buy · notatki");

    const previousLang = document.documentElement.lang;
    await clearUserSettingsForTests();
    await saveUserSettings({ locale: "pl" });
    render(
      <UserSettingsProvider>
        <RoundStrip
          replay={replay}
          tick={100}
          notes={[
            {
              round: 2,
              note: {
                groups: [],
                drawings: [{ type: "pen", color: "#fff", points: [{ x: 0, y: 0 }] }],
                pieces: [],
                bookmarks: [],
              },
            },
          ]}
          places={null}
        />
      </UserSettingsProvider>,
    );
    const chip = await screen.findByRole("listitem", { name: polish });
    expect(chip).toHaveAttribute("title", polish);
    document.documentElement.lang = previousLang;
    await clearUserSettingsForTests();
  });
});
