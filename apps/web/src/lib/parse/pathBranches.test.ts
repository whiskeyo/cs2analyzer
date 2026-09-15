import { describe, expect, it } from "vitest";
import { PATH_BRANCH_MIN_SHARE, PATH_BRANCH_PERCENT_SCALE } from "@/lib/shared/constants";
import {
  branchShare,
  buildPathBranches,
  formatBranchShareLabel,
  resamplePath,
  shareToPercent,
  type PathSample,
} from "./pathBranches";

const TIGHT = { mergeDistance: 50, minShare: PATH_BRANCH_MIN_SHARE, stepDistance: 100 };

function trail(xy: [number, number][]): { points: PathSample[] } {
  return { points: xy.map(([x, y]) => ({ x, y })) };
}

function repeats(count: number, xy: [number, number][]): { points: PathSample[] }[] {
  return Array.from({ length: count }, () => trail(xy));
}

describe("branchShare", () => {
  it("is run count over scoped total", () => {
    expect(branchShare(5, 20)).toBe(0.25);
    expect(branchShare(1, 3)).toBeCloseTo(1 / 3);
  });

  it("is zero when the tree is empty or the fork has no runs", () => {
    expect(branchShare(5, 0)).toBe(0);
    expect(branchShare(0, 20)).toBe(0);
    expect(branchShare(-1, 20)).toBe(0);
  });
});

describe("formatBranchShareLabel", () => {
  it("prints percent and count over total", () => {
    expect(formatBranchShareLabel(5, 20)).toBe("25% (5/20)");
    expect(formatBranchShareLabel(20, 20)).toBe("100% (20/20)");
    expect(formatBranchShareLabel(1, 3)).toBe(`${shareToPercent(1 / 3)}% (1/3)`);
  });

  it("rounds to an integer percent", () => {
    expect(shareToPercent(0.254)).toBe(25);
    expect(shareToPercent(0)).toBe(0);
    expect(shareToPercent(1)).toBe(PATH_BRANCH_PERCENT_SCALE);
  });
});

describe("resamplePath", () => {
  it("keeps the start and walks by step distance", () => {
    const samples = resamplePath(
      [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ],
      100,
    );
    expect(samples[0]).toEqual({ x: 0, y: 0 });
    expect(samples[1]).toEqual({ x: 100, y: 0 });
    expect(samples[2]).toEqual({ x: 200, y: 0 });
    expect(samples.at(-1)).toEqual({ x: 300, y: 0 });
  });

  it("returns empty for no points or a non-positive step", () => {
    expect(resamplePath([], 100)).toEqual([]);
    expect(resamplePath([{ x: 0, y: 0 }], 0)).toEqual([]);
  });
});

describe("buildPathBranches", () => {
  it("returns no branches for empty or single-point trails", () => {
    expect(buildPathBranches([])).toEqual([]);
    expect(buildPathBranches([trail([[0, 0]])])).toEqual([]);
  });

  it("labels a shared trunk 100% when every run stays together", () => {
    const path: [number, number][] = [
      [0, 0],
      [100, 0],
      [200, 0],
      [300, 0],
    ];
    const branches = buildPathBranches(repeats(8, path), TIGHT);
    expect(branches).toHaveLength(1);
    expect(branches[0]?.label).toBe("100% (8/8)");
    expect(branches[0]?.share).toBe(1);
    expect(branches[0]?.runCount).toBe(8);
    expect(branches[0]?.totalRuns).toBe(8);
  });

  it("splits a shared prefix into parent-relative forks", () => {
    const shared: [number, number][] = [
      [0, 0],
      [100, 0],
      [200, 0],
      [300, 0],
    ];
    const north: [number, number][] = [...shared, [400, 120], [500, 240]];
    const south: [number, number][] = [...shared, [400, -120], [500, -240]];
    const branches = buildPathBranches([...repeats(15, north), ...repeats(5, south)], TIGHT);
    const labels = branches.map((b) => b.label).sort();
    expect(labels).toContain("100% (20/20)");
    expect(labels).toContain("75% (15/20)");
    expect(labels).toContain("25% (5/20)");
    const trunk = branches.find((b) => b.label === "100% (20/20)");
    expect(trunk?.points.length).toBeGreaterThan(1);
    const left = branches.find((b) => b.label === "75% (15/20)");
    expect(left?.labelAt).toEqual(left?.points[Math.floor((left?.points.length ?? 0) / 2)]);
  });

  it("hides forks under the min share and keeps a 5% fork", () => {
    const main: [number, number][] = [
      [0, 0],
      [100, 0],
      [200, 0],
      [300, 0],
      [400, 0],
      [500, 0],
    ];
    const rare: [number, number][] = [
      [0, 0],
      [100, 0],
      [200, 0],
      [300, 0],
      [400, 200],
      [500, 400],
    ];
    const shown = buildPathBranches([...repeats(19, main), trail(rare)], TIGHT);
    expect(shown.map((b) => b.label)).toContain("5% (1/20)");

    const hidden = buildPathBranches([...repeats(20, main), trail(rare)], TIGHT);
    expect(hidden.every((b) => b.runCount !== 1)).toBe(true);
    expect(hidden.some((b) => b.label === "100% (21/21)")).toBe(true);
  });

  it("starts a separate tree when spawn clusters are far apart", () => {
    const a: [number, number][] = [
      [0, 0],
      [100, 0],
      [200, 0],
    ];
    const b: [number, number][] = [
      [0, 800],
      [100, 800],
      [200, 800],
    ];
    const branches = buildPathBranches([...repeats(4, a), ...repeats(4, b)], TIGHT);
    expect(branches).toHaveLength(2);
    expect(branches.every((row) => row.label === "50% (4/8)")).toBe(true);
  });
});
