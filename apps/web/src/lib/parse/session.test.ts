import { describe, expect, it } from "vitest";
import { demoId, loadedDemo } from "./session";
import type { Replay } from "@/lib/replay/replayTypes";

const replay = {
  header: { map_name: "de_anubis" },
} as Replay;

describe("loadedDemo", () => {
  it("keys a match by map, filename, and file identity for series stacks", () => {
    const file = new File([], "a.dem");
    const d = loadedDemo(replay, "a.dem", file);
    expect(d.id).toBe(demoId("a.dem", "de_anubis", file));
    expect(d.fileName).toBe("a.dem");
    expect(d.replay).toBe(replay);
  });

  it("gives different ids to same-named files with different bytes", () => {
    const a = loadedDemo(replay, "match.dem", new File(["a"], "match.dem"));
    const b = loadedDemo(replay, "match.dem", new File(["bb"], "match.dem"));
    expect(a.id).not.toBe(b.id);
  });
});
