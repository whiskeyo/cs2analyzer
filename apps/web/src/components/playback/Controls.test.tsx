import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_TICK_RATE } from "@/lib/shared/constants";
import { setPlaybackCommandSink } from "@/lib/playback/playbackCommands";
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
  const replayRef = { current: props.replay };
  const tickRef = { current: props.tick };
  renderHook(() =>
    usePlaybackCommandSink({
      replayRef,
      tickRef,
      selectedRef: { current: null },
      placesRef: { current: null },
      jump: props.onJump,
      undo: vi.fn(),
      redo: vi.fn(),
      togglePlaying: props.onTogglePlay,
      setFollow: vi.fn(),
      setTrails: vi.fn(),
      setSelected: vi.fn(),
    }),
  );
  return { ...render(<Controls {...props} />), tickRef, replayRef };
}

describe("Controls", () => {
  beforeEach(() => {
    setPlaybackCommandSink(null);
  });
  it("renders play and round clock during freeze", () => {
    renderControls(baseProps());
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.getByText(/R1 Freeze/)).toBeInTheDocument();
  });

  it("toggles play and pause", async () => {
    const onTogglePlay = vi.fn();
    const { rerender } = renderControls(baseProps({ onTogglePlay }));
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(onTogglePlay).toHaveBeenCalledTimes(1);

    rerender(<Controls {...baseProps({ playing: true, onTogglePlay })} />);
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

    rerender(<Controls {...baseProps({ tick: 23 * tps, onTick })} />);
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
    rerender(<Controls {...props} tick={30 * tps} />);
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
});
