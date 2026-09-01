import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, renderHook } from "@testing-library/react";
import { roundScrubRange } from "./roundTimeline";
import { useHotkeys } from "./useHotkeys";
import { makeKill, makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";

function makeHotkeyReplay() {
  const rounds = [
    makeRound({ number: 1, start_tick: 200, freeze_end_tick: 264, end_tick: 900 }),
    makeRound({ number: 2, start_tick: 1000, freeze_end_tick: 1064, end_tick: 1600 }),
  ];
  const ticks = makeTicks(2, 3);
  ticks.ticks[0] = 200;
  ticks.ticks[1] = 500;
  ticks.ticks[2] = 1000;
  return makeReplay({
    rounds,
    ticks,
    kills: [makeKill(400, 0, 1), makeKill(600, 0, 1)],
  });
}

function renderHotkeys(tick = 500, selected: number | null = null) {
  const replay = makeHotkeyReplay();
  const replayRef: { current: typeof replay | null } = { current: replay };
  const tickRef = { current: tick };
  const playingRef = { current: false };
  const selectedRef = { current: selected };
  const placesRef = { current: null };

  const jump = vi.fn();
  const undo = vi.fn();
  const redo = vi.fn();
  const setPlaying = vi.fn((v: boolean) => {
    playingRef.current = v;
  });
  const togglePlaying = vi.fn(() => {
    setPlaying(!playingRef.current);
  });
  const setFollow = vi.fn();
  const setTrails = vi.fn();
  const setSelected = vi.fn((i: number | null) => {
    selectedRef.current = i;
  });

  renderHook(() =>
    useHotkeys({
      replayRef,
      tickRef,
      playingRef,
      selectedRef,
      placesRef,
      jump,
      undo,
      redo,
      setPlaying,
      togglePlaying,
      setFollow,
      setTrails,
      setSelected,
    }),
  );

  const keyDown = (init: KeyboardEventInit) => {
    act(() => {
      fireEvent.keyDown(window, init);
    });
  };

  const round = replay.rounds[0];
  const { min, max } = roundScrubRange(round, replay.rounds, {
    min: replay.ticks.ticks[0] ?? 0,
    max: replay.header.playback_ticks,
  });

  return {
    replay,
    replayRef,
    tickRef,
    playingRef,
    selectedRef,
    jump,
    undo,
    redo,
    setPlaying,
    togglePlaying,
    setFollow,
    setTrails,
    setSelected,
    keyDown,
    round,
    min,
    max,
  };
}

describe("useHotkeys", () => {
  it("ignores keys while typing in form fields", () => {
    const h = renderHotkeys();
    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => {
      fireEvent.keyDown(input, { key: " " });
    });
    expect(h.setPlaying).not.toHaveBeenCalled();
    input.remove();
  });

  it("toggles playback on Space", () => {
    const h = renderHotkeys();
    h.keyDown({ code: "Space" });
    expect(h.togglePlaying).toHaveBeenCalledTimes(1);

    h.playingRef.current = true;
    h.keyDown({ code: "Space" });
    expect(h.togglePlaying).toHaveBeenCalledTimes(2);
  });

  it("jumps to adjacent rounds on [ and ]", () => {
    const h = renderHotkeys(500);
    h.keyDown({ code: "BracketRight", key: "]" });
    expect(h.jump).toHaveBeenCalledWith(0, true, h.replay.rounds[1]);

    h.jump.mockClear();
    h.tickRef.current = 1100;
    h.keyDown({ code: "BracketLeft", key: "[" });
    expect(h.jump).toHaveBeenCalledWith(0, true, h.replay.rounds[0]);
  });

  it("still handles round hotkeys while the timeline scrubber is focused", () => {
    const h = renderHotkeys(500);
    const range = document.createElement("input");
    range.type = "range";
    document.body.appendChild(range);
    range.focus();

    h.keyDown({ code: "BracketRight", key: "]" });
    expect(h.jump).toHaveBeenCalledWith(0, true, h.replay.rounds[1]);

    h.keyDown({ code: "Space", key: " " });
    expect(h.togglePlaying).toHaveBeenCalledTimes(1);
    range.remove();
  });

  it("ignores repeated Space and bracket presses", () => {
    const h = renderHotkeys(500);
    h.keyDown({ code: "Space", repeat: true });
    expect(h.togglePlaying).not.toHaveBeenCalled();

    h.keyDown({ code: "BracketRight", key: "]", repeat: true });
    expect(h.jump).not.toHaveBeenCalled();
  });

  it("plays on Space after [ without activating the previous-round button", () => {
    const h = renderHotkeys(1100);
    const btn = document.createElement("button");
    btn.className = "controls";
    btn.title = "Previous round ([)";
    const onClick = vi.fn();
    btn.onclick = onClick;
    document.body.appendChild(btn);
    btn.focus();

    h.keyDown({ code: "BracketLeft", key: "[" });
    expect(h.jump).toHaveBeenCalled();
    h.jump.mockClear();

    h.keyDown({ code: "Space", key: " " });
    expect(h.togglePlaying).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
    expect(h.jump).not.toHaveBeenCalled();
    btn.remove();
  });

  it("does not jump rounds when Space is pressed on a focused transport button", () => {
    const h = renderHotkeys(500);
    const onJump = h.jump;
    const btn = document.createElement("button");
    btn.className = "controls";
    btn.title = "Previous round ([)";
    btn.onclick = () => onJump(-1);
    document.body.appendChild(btn);
    btn.focus();

    h.keyDown({ code: "Space", key: " " });
    expect(h.togglePlaying).toHaveBeenCalledTimes(1);
    expect(onJump).not.toHaveBeenCalled();
    btn.remove();
  });

  it("plays on Space after ] without re-activating a focused round button", () => {
    const h = renderHotkeys(500);
    const btn = document.createElement("button");
    const onClick = vi.fn();
    btn.onclick = onClick;
    document.body.appendChild(btn);
    btn.focus();

    h.keyDown({ key: "]" });
    expect(h.jump).toHaveBeenCalledTimes(1);
    h.jump.mockClear();

    h.keyDown({ code: "Space" });
    expect(h.togglePlaying).toHaveBeenCalledTimes(1);
    expect(h.jump).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    btn.remove();
  });

  it("steps kill events on , and .", () => {
    const h = renderHotkeys(500);
    h.keyDown({ key: "," });
    expect(h.jump).toHaveBeenCalledWith(400);

    h.jump.mockClear();
    h.keyDown({ key: "." });
    expect(h.jump).toHaveBeenCalledWith(600);
  });

  it("jumps to round start on Home", () => {
    const h = renderHotkeys(500);
    h.keyDown({ key: "Home" });
    expect(h.jump).toHaveBeenCalledWith(0, true, h.round);
  });

  it("toggles follow when a player is selected on F", () => {
    const h = renderHotkeys(500, 0);
    h.keyDown({ key: "f" });
    expect(h.setFollow).toHaveBeenCalledTimes(1);
    const updater = h.setFollow.mock.calls[0][0] as (prev: boolean) => boolean;
    expect(updater(true)).toBe(false);

    h.setFollow.mockClear();
    h.keyDown({ key: "F" });
    expect(h.setFollow).toHaveBeenCalledTimes(1);
  });

  it("does not toggle follow without a selection", () => {
    const h = renderHotkeys();
    h.keyDown({ key: "f" });
    expect(h.setFollow).not.toHaveBeenCalled();
  });

  it("toggles trails on T", () => {
    const h = renderHotkeys();
    h.keyDown({ key: "t" });
    expect(h.setTrails).toHaveBeenCalledTimes(1);
    const updater = h.setTrails.mock.calls[0][0] as (prev: boolean) => boolean;
    expect(updater(false)).toBe(true);
  });

  it("clears selection and follow on Escape", () => {
    const h = renderHotkeys(500, 0);
    h.keyDown({ key: "Escape" });
    expect(h.setSelected).toHaveBeenCalledWith(null);
    expect(h.setFollow).toHaveBeenCalledWith(false);
  });

  it("scrubs by tick steps on arrow keys", () => {
    const h = renderHotkeys(500);
    h.keyDown({ key: "ArrowRight" });
    expect(h.jump).toHaveBeenCalledWith(Math.min(h.max, Math.max(h.min, 516)));

    h.jump.mockClear();
    h.keyDown({ key: "ArrowLeft" });
    expect(h.jump).toHaveBeenCalledWith(Math.min(h.max, Math.max(h.min, 484)));

    h.jump.mockClear();
    h.keyDown({ key: "ArrowRight", shiftKey: true });
    expect(h.jump).toHaveBeenCalledWith(Math.min(h.max, Math.max(h.min, 564)));
  });

  it("undoes and redoes on Ctrl+Z and Ctrl+Shift+Z", () => {
    const h = renderHotkeys();
    h.keyDown({ key: "z", ctrlKey: true });
    expect(h.undo).toHaveBeenCalledTimes(1);
    expect(h.redo).not.toHaveBeenCalled();

    h.keyDown({ key: "z", ctrlKey: true, shiftKey: true });
    expect(h.redo).toHaveBeenCalledTimes(1);
  });

  it("does nothing when replay is missing", () => {
    const h = renderHotkeys();
    h.replayRef.current = null;
    h.keyDown({ key: "Home" });
    expect(h.jump).not.toHaveBeenCalled();
  });
});
