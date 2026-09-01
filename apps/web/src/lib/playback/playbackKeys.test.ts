/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { hotkeyTargetBlocksKeys, keyToPlaybackCommand, roundHotkeyDir } from "./playbackKeys";

describe("hotkeyTargetBlocksKeys", () => {
  it("allows the timeline range scrubber to keep global hotkeys", () => {
    const range = document.createElement("input");
    range.type = "range";
    document.body.appendChild(range);
    range.focus();
    expect(hotkeyTargetBlocksKeys(range)).toBe(false);
    range.remove();
  });

  it("blocks text inputs", () => {
    const input = document.createElement("input");
    input.type = "text";
    expect(hotkeyTargetBlocksKeys(input)).toBe(true);
  });
});

describe("roundHotkeyDir", () => {
  it("maps bracket keys by key and code", () => {
    expect(roundHotkeyDir({ key: "[", code: "BracketLeft" })).toBe(-1);
    expect(roundHotkeyDir({ key: "]", code: "BracketRight" })).toBe(1);
  });
});

describe("keyToPlaybackCommand", () => {
  it("maps Space to toggle-play when a demo is loaded", () => {
    expect(
      keyToPlaybackCommand({ code: "Space", key: " " } as KeyboardEvent, {
        hasReplay: true,
        hasSelection: false,
      }),
    ).toEqual({ type: "toggle-play" });
  });

  it("maps brackets to round jumps", () => {
    expect(
      keyToPlaybackCommand({ code: "BracketLeft", key: "[" } as KeyboardEvent, {
        hasReplay: true,
        hasSelection: false,
      }),
    ).toEqual({ type: "jump-round", dir: -1 });
  });
});
