import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { roundJumpTick } from "@/lib/playback/roundAutoplay";
import { DEFAULT_TICK_RATE } from "@/lib/shared/constants";
import { PlaybackCommandProvider } from "@/lib/playback/playbackCommandContext";
import { createPlaybackCommandBus, setPlaybackCommandSink } from "@/lib/playback/playbackCommands";
import { usePlaybackCommandSink } from "@/lib/playback/usePlaybackCommandSink";
import { makeBombEvent, makeKill, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { Controls } from "./Controls";

const tps = DEFAULT_TICK_RATE;

function baseProps(overrides: Partial<Parameters<typeof Controls>[0]> = {}) {
  const replay = makeReplay({
    rounds: [
      makeRound({
        number: 1,
        start_tick: 0,
        freeze_end_tick: 2 * tps,
        end_tick: 20 * tps,
      }),
      makeRound({
        number: 2,
        start_tick: 21 * tps,
        freeze_end_tick: 23 * tps,
        end_tick: 40 * tps,
      }),
    ],
    kills: [makeKill(10 * tps, 0, 1)],
  });
  return {
    replay,
    tick: 0,
    notes: [],
    playing: false,
    speed: 1,
    roundAutoplay: false,
    onTick: vi.fn(),
    onJump: vi.fn(),
    onTogglePlay: vi.fn(),
    onPlaying: vi.fn(),
    onSpeed: vi.fn(),
    onRoundAutoplay: vi.fn(),
    ...overrides,
  };
}

function renderControls(props: Parameters<typeof Controls>[0]) {
  const bus = createPlaybackCommandBus();
  const replayRef = { current: props.replay };
  const tickRef = { current: props.tick };

  function Tree({ controls }: { controls: Parameters<typeof Controls>[0] }) {
    replayRef.current = controls.replay;
    tickRef.current = controls.tick;
    usePlaybackCommandSink({
      replayRef,
      tickRef,
      selectedRef: { current: null },
      placesRef: { current: null },
      jump: controls.onJump,
      undo: vi.fn(),
      redo: vi.fn(),
      togglePlaying: controls.onTogglePlay,
      setFollow: vi.fn(),
      setTrails: vi.fn(),
      setSelected: vi.fn(),
    });
    return <Controls {...controls} />;
  }

  const view = render(
    <PlaybackCommandProvider bus={bus}>
      <Tree controls={props} />
    </PlaybackCommandProvider>,
  );

  const rerender = (next: Parameters<typeof Controls>[0]) => {
    view.rerender(
      <PlaybackCommandProvider bus={bus}>
        <Tree controls={next} />
      </PlaybackCommandProvider>,
    );
  };

  return { ...view, rerender, tickRef, replayRef };
}

describe("Controls", () => {
  beforeEach(() => {
    setPlaybackCommandSink(null);
  });
  it("renders play and round clock during freeze", () => {
    renderControls(baseProps());
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.getByText(/R1 Freeze/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export clip: full round" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export clip: from plant" })).toBeInTheDocument();
  });

  it("counts the live round clock down from 1:55", () => {
    const { rerender } = renderControls(baseProps({ tick: 2 * tps }));
    expect(screen.getByText(/R1 1:55/)).toBeInTheDocument();
    rerender(baseProps({ tick: 12 * tps }));
    expect(screen.getByText(/R1 1:45/)).toBeInTheDocument();
  });

  it("counts a parsed round length down from 1:30", () => {
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          freeze_end_tick: 2 * tps,
          end_tick: 200 * tps,
          round_time_s: 90,
        }),
      ],
    });
    renderControls(baseProps({ replay, tick: 2 * tps }));
    expect(screen.getByText(/R1 1:30/)).toBeInTheDocument();
  });

  it("toggles play and pause", async () => {
    const onTogglePlay = vi.fn();
    const { rerender } = renderControls(baseProps({ onTogglePlay }));
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(onTogglePlay).toHaveBeenCalledTimes(1);

    rerender(baseProps({ playing: true, onTogglePlay }));
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(onTogglePlay).toHaveBeenCalledTimes(2);
  });

  it("skips freeze and jumps to the next round", async () => {
    const onJump = vi.fn();
    renderControls(
      baseProps({
        tick: tps,
        onJump,
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Skip freeze" }));
    expect(onJump).toHaveBeenCalledWith(2 * tps);

    await userEvent.click(screen.getByTitle("Next round (])"));
    expect(onJump).toHaveBeenCalledWith(0, true, expect.objectContaining({ number: 2 }));
  });

  it("changes speed and toggles round autoplay", async () => {
    const onSpeed = vi.fn();
    const onRoundAutoplay = vi.fn();
    renderControls(baseProps({ onSpeed, onRoundAutoplay }));

    await userEvent.selectOptions(screen.getByLabelText("Speed"), "2");
    expect(onSpeed).toHaveBeenCalledWith(2);

    await userEvent.click(screen.getByRole("button", { name: /Round autoplay off/ }));
    expect(onRoundAutoplay).toHaveBeenCalledWith(true);
  });

  it("scrubs the round timeline and pauses playback", () => {
    const onTick = vi.fn();
    const onPlaying = vi.fn();
    renderControls(
      baseProps({
        tick: 5 * tps,
        playing: true,
        onTick,
        onPlaying,
      }),
    );

    const slider = screen.getByLabelText("Round timeline") as HTMLInputElement;
    slider.setPointerCapture = vi.fn();
    slider.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(slider);
    expect(onPlaying).toHaveBeenCalledWith(false);

    fireEvent.change(slider, { target: { value: String(12 * tps) } });
    expect(onTick).toHaveBeenCalledWith(12 * tps);
  });

  it("ignores timeline changes that are not from a pointer scrub", () => {
    const onTick = vi.fn();
    const { rerender } = renderControls(baseProps({ tick: 5 * tps, onTick }));
    const slider = screen.getByLabelText("Round timeline");
    fireEvent.change(slider, { target: { value: String(12 * tps) } });
    expect(onTick).not.toHaveBeenCalled();

    rerender(baseProps({ tick: 23 * tps, onTick }));
    fireEvent.change(screen.getByLabelText("Round timeline"), {
      target: { value: String(20 * tps) },
    });
    expect(onTick).not.toHaveBeenCalled();
  });

  it("steps the tick forward and backward", async () => {
    const onJump = vi.fn();
    renderControls(
      baseProps({
        tick: 10 * tps,
        onJump,
      }),
    );

    await userEvent.click(screen.getByTitle("Step forward"));
    expect(onJump).toHaveBeenCalledWith(10 * tps + 8);

    await userEvent.click(screen.getByTitle("Step back"));
    expect(onJump).toHaveBeenCalledWith(10 * tps - 8);
  });

  it("jumps kills and rounds", async () => {
    const onJump = vi.fn();
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          freeze_end_tick: 2 * tps,
          end_tick: 20 * tps,
        }),
        makeRound({
          number: 2,
          start_tick: 21 * tps,
          freeze_end_tick: 23 * tps,
          end_tick: 40 * tps,
        }),
      ],
      kills: [makeKill(10 * tps, 0, 1), makeKill(30 * tps, 0, 1)],
    });
    const props = baseProps({
      replay,
      tick: 12 * tps,
      onJump,
    });
    const { rerender, tickRef } = renderControls(props);

    await userEvent.click(screen.getByTitle("Next kill (.)"));
    expect(onJump).toHaveBeenCalledWith(30 * tps);

    onJump.mockClear();
    tickRef.current = 30 * tps;
    rerender({ ...props, tick: 30 * tps });
    await userEvent.click(screen.getByTitle("Previous round ([)"));
    expect(onJump).toHaveBeenCalledWith(0, true, expect.objectContaining({ number: 1 }));
  });

  it("jumps from timeline events and bookmarks", async () => {
    const onJump = vi.fn();
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          freeze_end_tick: 2 * tps,
          end_tick: 20 * tps,
        }),
      ],
      kills: [makeKill(10 * tps, 0, 1)],
      bombEvents: [makeBombEvent({ tick: 15 * tps, kind: "planted", player: 1 })],
    });
    const notes = [
      {
        round: 1,
        note: {
          groups: [],
          drawings: [],
          pieces: [],
          bookmarks: [
            {
              color: "#fff",
              text: "Exec",
              tick: 8 * tps,
              start_tick: 8 * tps,
              end_tick: 12 * tps,
            },
          ],
        },
      },
    ];
    renderControls(
      baseProps({
        replay,
        tick: 5 * tps,
        notes,
        onJump,
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: /planted/i }));
    expect(onJump).toHaveBeenCalledWith(15 * tps);

    await userEvent.click(screen.getByRole("button", { name: "Exec" }));
    expect(onJump).toHaveBeenCalled();
  });

  it("does not render a Round dropdown on the scrubber chrome", () => {
    renderControls(baseProps());
    expect(screen.queryByRole("combobox", { name: "Round" })).not.toBeInTheDocument();
  });

  it("shows the shared C4 clock after a plant and round time before it", () => {
    const plant = 8 * tps;
    const first = makeRound({
      number: 1,
      start_tick: 0,
      freeze_end_tick: 2 * tps,
      end_tick: 80 * tps,
    });
    const second = makeRound({
      number: 2,
      start_tick: 90 * tps,
      freeze_end_tick: 92 * tps,
      end_tick: 160 * tps,
    });
    const replay = makeReplay({
      rounds: [first, second],
      bombEvents: [
        makeBombEvent({ tick: plant, kind: "planted" }),
        makeBombEvent({ tick: plant + tps, kind: "begin_defuse", haskit: false, player: 0 }),
        makeBombEvent({ tick: plant + 15 * tps, kind: "defused", player: 0 }),
      ],
    });
    const { rerender } = renderControls(baseProps({ replay, tick: 2 * tps }));
    expect(screen.getByText(/R1 1:55/)).toBeInTheDocument();

    rerender(baseProps({ replay, tick: plant + 10 * tps }));
    expect(screen.getByText(/R1 C4 30\.0/)).toBeInTheDocument();

    rerender(baseProps({ replay, tick: plant - 1 }));
    expect(screen.getByText(/R1 \d:\d{2}/)).toBeInTheDocument();
    expect(screen.queryByText(/C4 /)).not.toBeInTheDocument();

    rerender(baseProps({ replay, tick: plant + 10 * tps, playing: true, speed: 0.5 }));
    expect(screen.getByText(/R1 C4 30\.0/)).toBeInTheDocument();
    for (const speed of [2, 4]) {
      rerender(baseProps({ replay, tick: plant + 10 * tps, playing: true, speed }));
      expect(screen.getByText(/R1 C4 30\.0/)).toBeInTheDocument();
    }
    rerender(baseProps({ replay, tick: plant + 10 * tps, playing: false, speed: 1 }));
    expect(screen.getByText(/R1 C4 30\.0/)).toBeInTheDocument();

    rerender(baseProps({ replay, tick: plant + 20 * tps }));
    expect(screen.getByText(/R1 C4 25\.0/)).toBeInTheDocument();

    rerender(baseProps({ replay, tick: roundJumpTick(second) }));
    expect(screen.getByText(/R2 1:55/)).toBeInTheDocument();
    expect(screen.queryByText(/C4 /)).not.toBeInTheDocument();

    rerender(baseProps({ replay, tick: roundJumpTick(first) }));
    expect(screen.getByText(/R1 1:55/)).toBeInTheDocument();
  });

  it("holds C4 0.0 after an explosion", () => {
    const plant = 8 * tps;
    const replay = makeReplay({
      rounds: [
        makeRound({ number: 1, start_tick: 0, freeze_end_tick: 2 * tps, end_tick: 80 * tps }),
      ],
      bombEvents: [
        makeBombEvent({ tick: plant, kind: "planted" }),
        makeBombEvent({ tick: plant + 12 * tps, kind: "exploded" }),
      ],
    });
    renderControls(baseProps({ replay, tick: plant + 20 * tps }));
    expect(screen.getByText(/R1 C4 0\.0/)).toBeInTheDocument();
  });
});
