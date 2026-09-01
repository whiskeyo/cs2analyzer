import { describe, expect, it } from "vitest";
import { makePlayer, makeReplay } from "@/lib/testing/fixtures";
import {
  buildSeries,
  canonicalSeriesTeam,
  defaultFocalTeam,
  demoId,
  inferFocalTeam,
  loadedDemo,
  withFocalTeam,
} from "./session";
import type { Replay } from "@/lib/replay/replayTypes";

const replay = {
  header: { map_name: "de_anubis", team_ct: "Spirit", team_t: "Vitality" },
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

describe("demoId", () => {
  it("falls back to map and filename when no file handle is provided", () => {
    expect(demoId("a.dem", "de_mirage")).toBe("de_mirage|a.dem");
  });
});

describe("buildSeries / withFocalTeam", () => {
  it("picks a focal team and canonical aliases across demos", () => {
    const demoA = loadedDemo(
      makeReplay({
        header: { team_ct: "Spirit", team_t: "B" },
        players: [makePlayer(0, "CT", "Spirit", 100)],
      }),
      "a.dem",
      new File([], "a.dem"),
    );
    const demoB = loadedDemo(
      makeReplay({
        header: { team_ct: "Team Spirit", team_t: "C" },
        players: [makePlayer(0, "CT", "Team Spirit", 101)],
      }),
      "b.dem",
      new File([], "b.dem"),
    );
    const series = buildSeries("de_mirage", [demoA, demoB]);
    expect(series.focalTeam).toBeTruthy();
    expect(series.tagsByDemo.size).toBe(2);
    expect(canonicalSeriesTeam(series, "Spirit")).toBe(series.focalTeam);

    const same = withFocalTeam(series, series.focalTeam);
    expect(same).toBe(series);

    const swapped = withFocalTeam(series, "Vitality");
    expect(swapped.focalTeam).toBeTruthy();
    expect(swapped).not.toBe(series);
  });

  it("breaks focal-team ties using the first demo header", () => {
    const demos = [
      loadedDemo(
        makeReplay({ header: { team_ct: "A", team_t: "B" } }),
        "a.dem",
        new File([], "a.dem"),
      ),
      loadedDemo(
        makeReplay({ header: { team_ct: "C", team_t: "D" } }),
        "b.dem",
        new File([], "b.dem"),
      ),
    ];
    expect(defaultFocalTeam(demos)).toBe("A");
  });

  it("prefers the shared T-side name when CT candidates tie", () => {
    const demos = [
      loadedDemo(
        makeReplay({ header: { team_ct: "Alpha", team_t: "Bravo" } }),
        "a.dem",
        new File([], "a.dem"),
      ),
      loadedDemo(
        makeReplay({ header: { team_ct: "Charlie", team_t: "Bravo" } }),
        "b.dem",
        new File([], "b.dem"),
      ),
    ];
    expect(defaultFocalTeam(demos)).toBe("Bravo");
  });

  it("delegates inferFocalTeam to the default picker", () => {
    const demos = [
      loadedDemo(
        makeReplay({ header: { team_ct: "A", team_t: "B" } }),
        "a.dem",
        new File([], "a.dem"),
      ),
    ];
    expect(inferFocalTeam(demos)).toBe("A");
  });
});
