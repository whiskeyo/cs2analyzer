import { describe, expect, it, vi } from "vitest";
import { createPlaybackCommandBus } from "./playbackCommands";

describe("createPlaybackCommandBus", () => {
  it("keeps two buses from sharing a sink", () => {
    const a = createPlaybackCommandBus();
    const b = createPlaybackCommandBus();
    const onA = vi.fn();
    const onB = vi.fn();
    a.setSink(onA);
    b.setSink(onB);
    a.send({ type: "toggle-play" });
    expect(onA).toHaveBeenCalledTimes(1);
    expect(onB).not.toHaveBeenCalled();
  });
});
