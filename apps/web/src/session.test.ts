import { describe, expect, it } from "vitest";
import { demoId, loadedDemo } from "./session";
import type { Replay } from "./types";

const replay = {
  header: { map_name: "de_anubis" },
} as Replay;

describe("loadedDemo", () => {
  it("keys a match by map and filename so overlays can stack several files", () => {
    const d = loadedDemo(replay, "a.dem");
    expect(d.id).toBe(demoId("a.dem", "de_anubis"));
    expect(d.fileName).toBe("a.dem");
    expect(d.replay).toBe(replay);
  });
});
