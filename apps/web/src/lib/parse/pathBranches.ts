import {
  PATH_BRANCH_MERGE_DISTANCE,
  PATH_BRANCH_MERGE_MAX,
  PATH_BRANCH_MERGE_MIN,
  PATH_BRANCH_MIN_SHARE,
  PATH_BRANCH_MIN_SHARE_MAX,
  PATH_BRANCH_MIN_SHARE_MIN,
  PATH_BRANCH_PERCENT_SCALE,
  PATH_BRANCH_STEP_DISTANCE,
  PATH_BRANCH_STEP_GAP,
  PATH_BRANCH_STEP_MAX,
  PATH_BRANCH_STEP_MIN,
} from "@/lib/shared/constants";

/** World XY sample along a player run. */
export interface PathSample {
  x: number;
  y: number;
}

export interface PathBranchOptions {
  /** World-unit radius for treating samples as the same fork. */
  mergeDistance: number;
  /** Hide branches whose share of scoped runs is below this. */
  minShare: number;
  /** Arc-length resample step before clustering (world units). */
  stepDistance: number;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Sanitize Overall knobs. Missing values fall back to the shipped constants.
 * Step is always kept strictly below merge (`PATH_BRANCH_STEP_GAP`).
 */
export function clampPathBranchOptions(partial?: Partial<PathBranchOptions>): PathBranchOptions {
  const mergeDistance = clampInt(
    finiteOr(partial?.mergeDistance, PATH_BRANCH_MERGE_DISTANCE),
    PATH_BRANCH_MERGE_MIN,
    PATH_BRANCH_MERGE_MAX,
  );
  const stepCap = Math.min(PATH_BRANCH_STEP_MAX, mergeDistance - PATH_BRANCH_STEP_GAP);
  const stepDistance = clampInt(
    finiteOr(partial?.stepDistance, PATH_BRANCH_STEP_DISTANCE),
    PATH_BRANCH_STEP_MIN,
    Math.max(PATH_BRANCH_STEP_MIN, stepCap),
  );
  const boundedShare = Math.min(
    PATH_BRANCH_MIN_SHARE_MAX,
    Math.max(PATH_BRANCH_MIN_SHARE_MIN, finiteOr(partial?.minShare, PATH_BRANCH_MIN_SHARE)),
  );
  const minShare = Math.round(boundedShare * PATH_BRANCH_PERCENT_SCALE) / PATH_BRANCH_PERCENT_SCALE;
  return { mergeDistance, stepDistance, minShare };
}

export const DEFAULT_PATH_BRANCH_OPTIONS: PathBranchOptions = clampPathBranchOptions();

export interface PathBranch {
  /** Centroid polyline of this merged segment. */
  points: PathSample[];
  /** Runs that entered this fork. */
  runCount: number;
  /** Scoped runs in the tree (selected player, or the whole side). */
  totalRuns: number;
  /** `runCount / totalRuns` (0–1). */
  share: number;
  /** `25% (5/20)` — share of scoped runs that took this fork. */
  label: string;
  /** World point for the percentage label (mid-segment). */
  labelAt: PathSample;
}

interface PathRun {
  points: PathSample[];
}

/** Share of scoped runs on a fork. Zero when the tree is empty. */
export function branchShare(runCount: number, totalRuns: number): number {
  if (totalRuns <= 0 || runCount <= 0) return 0;
  return runCount / totalRuns;
}

/** Integer percent for Overall labels. */
export function shareToPercent(share: number): number {
  if (!Number.isFinite(share) || share <= 0) return 0;
  return Math.round(share * PATH_BRANCH_PERCENT_SCALE);
}

/** `25% (5/20)` — percent of scoped runs, then count over total. */
export function formatBranchShareLabel(runCount: number, totalRuns: number): string {
  const percent = shareToPercent(branchShare(runCount, totalRuns));
  return `${percent}% (${runCount}/${totalRuns})`;
}

function hypot2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Evenly spaced samples along a polyline so step index ≈ progress. */
export function resamplePath(points: PathSample[], stepDistance: number): PathSample[] {
  if (points.length === 0 || !(stepDistance > 0)) return [];
  const first = points[0];
  if (!first) return [];
  const out: PathSample[] = [{ x: first.x, y: first.y }];
  let leftover = 0;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    if (!from || !to) continue;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const seg = Math.hypot(dx, dy);
    if (seg === 0) continue;
    const ux = dx / seg;
    const uy = dy / seg;
    let x = from.x;
    let y = from.y;
    let remaining = seg;
    while (leftover + remaining >= stepDistance) {
      const take = stepDistance - leftover;
      x += ux * take;
      y += uy * take;
      out.push({ x, y });
      remaining -= take;
      leftover = 0;
    }
    leftover += remaining;
  }
  const last = points[points.length - 1];
  const tail = out[out.length - 1];
  if (last && tail && hypot2(last.x, last.y, tail.x, tail.y) > 0) {
    out.push({ x: last.x, y: last.y });
  }
  return out;
}

function findRoot(parent: number[], index: number): number {
  let i = index;
  while (parent[i] !== i) {
    parent[i] = parent[parent[i]!]!;
    i = parent[i]!;
  }
  return i;
}

/** Single-linkage clusters of runs whose sample at `step` is within merge distance. */
function clusterAt(runs: PathRun[], step: number, mergeDistance: number): PathRun[][] {
  const n = runs.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const merge2 = mergeDistance * mergeDistance;
  for (let i = 0; i < n; i++) {
    const a = runs[i]?.points[step];
    if (!a) continue;
    for (let j = i + 1; j < n; j++) {
      const b = runs[j]?.points[step];
      if (!b) continue;
      if (hypot2(a.x, a.y, b.x, b.y) <= merge2) {
        const pa = findRoot(parent, i);
        const pb = findRoot(parent, j);
        if (pa !== pb) parent[pb] = pa;
      }
    }
  }
  const groups = new Map<number, PathRun[]>();
  for (let i = 0; i < n; i++) {
    const run = runs[i];
    if (!run) continue;
    const root = findRoot(parent, i);
    const list = groups.get(root);
    if (list) list.push(run);
    else groups.set(root, [run]);
  }
  return [...groups.values()];
}

function centroidAt(runs: PathRun[], step: number): PathSample | null {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const run of runs) {
    const point = run.points[step];
    if (!point) continue;
    sx += point.x;
    sy += point.y;
    n += 1;
  }
  if (n === 0) return null;
  return { x: sx / n, y: sy / n };
}

function emitBranch(points: PathSample[], runCount: number, totalRuns: number): PathBranch | null {
  if (points.length < 2) return null;
  const mid = points[Math.floor(points.length / 2)];
  if (!mid) return null;
  const share = branchShare(runCount, totalRuns);
  return {
    points,
    runCount,
    totalRuns,
    share,
    label: formatBranchShareLabel(runCount, totalRuns),
    labelAt: { x: mid.x, y: mid.y },
  };
}

function grow(
  runs: PathRun[],
  fromStep: number,
  totalRuns: number,
  opts: PathBranchOptions,
  seed: PathSample | undefined,
): PathBranch[] {
  if (runs.length === 0) return [];
  if (fromStep > 0 && branchShare(runs.length, totalRuns) < opts.minShare) {
    return [];
  }

  const points: PathSample[] = seed ? [{ x: seed.x, y: seed.y }] : [];
  let step = fromStep;

  while (true) {
    const alive = runs.filter((run) => run.points.length > step);
    if (alive.length === 0) {
      const branch = emitBranch(points, runs.length, totalRuns);
      return branch ? [branch] : [];
    }

    const clusters = clusterAt(alive, step, opts.mergeDistance);
    if (clusters.length === 1) {
      const center = centroidAt(clusters[0]!, step);
      if (center) points.push(center);
      step += 1;
      continue;
    }

    const out: PathBranch[] = [];
    const trunk = emitBranch(points, runs.length, totalRuns);
    if (trunk) out.push(trunk);
    const forkSeed = points.at(-1);
    for (const cluster of clusters) {
      out.push(...grow(cluster, step, totalRuns, opts, forkSeed));
    }
    return out;
  }
}

/**
 * Collapse overlapping runs into a path tree. Early samples merge when they
 * stay within `mergeDistance`; later splits become child forks labeled with
 * each fork's share of **all scoped runs** (`25% (5/20)`).
 *
 * Scope is whoever produced `trails` (one player, or every teammate on the
 * selected side). Tiny forks below `minShare` are dropped.
 */
export function buildPathBranches(
  trails: { points: PathSample[] }[],
  options?: Partial<PathBranchOptions>,
): PathBranch[] {
  const opts: PathBranchOptions = { ...DEFAULT_PATH_BRANCH_OPTIONS, ...options };
  const runs: PathRun[] = [];
  for (const trail of trails) {
    const points = resamplePath(trail.points, opts.stepDistance);
    if (points.length < 2) continue;
    runs.push({ points });
  }
  if (runs.length === 0) return [];

  const totalRuns = runs.length;
  const startClusters = clusterAt(runs, 0, opts.mergeDistance);
  const out: PathBranch[] = [];
  for (const cluster of startClusters) {
    if (branchShare(cluster.length, totalRuns) < opts.minShare) continue;
    out.push(...grow(cluster, 0, totalRuns, opts, undefined));
  }
  return out;
}
