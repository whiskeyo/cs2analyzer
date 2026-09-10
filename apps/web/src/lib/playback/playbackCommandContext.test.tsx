/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaybackCommandProvider, useSendPlaybackCommand } from "./playbackCommandContext";
import { createPlaybackCommandBus } from "./playbackCommands";
import { usePlaybackCommandSink } from "./usePlaybackCommandSink";
import { makeReplay } from "@/lib/testing/fixtures";

function JumpButton() {
  const send = useSendPlaybackCommand();
  return (
    <button type="button" onClick={() => send({ type: "jump", tick: 0, pause: true })}>
      Jump
    </button>
  );
}

function Sink({ jump }: { jump: ReturnType<typeof vi.fn> }) {
  const replay = makeReplay();
  usePlaybackCommandSink({
    replayRef: { current: replay },
    tickRef: { current: 0 },
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

describe("PlaybackCommandProvider", () => {
  it("delivers child sends only when the sink is inside the provider", async () => {
    const bus = createPlaybackCommandBus();
    const inside = vi.fn();
    render(
      <PlaybackCommandProvider bus={bus}>
        <Sink jump={inside} />
        <JumpButton />
      </PlaybackCommandProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Jump" }));
    expect(inside).toHaveBeenCalledWith(0, true, undefined);
  });

  it("does not deliver child sends to a sink registered outside the provider", async () => {
    const bus = createPlaybackCommandBus();
    const outside = vi.fn();
    function Trap() {
      return (
        <>
          <Sink jump={outside} />
          <PlaybackCommandProvider bus={bus}>
            <JumpButton />
          </PlaybackCommandProvider>
        </>
      );
    }
    render(<Trap />);
    await userEvent.click(screen.getByRole("button", { name: "Jump" }));
    expect(outside).not.toHaveBeenCalled();
  });
});
