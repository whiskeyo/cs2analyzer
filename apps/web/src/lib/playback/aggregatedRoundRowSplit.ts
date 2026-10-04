import { AGGREGATED_ROUND_ROW_SPLIT_HYSTERESIS_PX } from "@/lib/shared/constants";

/**
 * Unsplit chip-track width. Uses the measure element's own width and, if a narrow
 * ancestor clamps that, the sum of its nowrap children.
 */
export function aggregatedRoundRowNeededWidth(measure: HTMLElement): number {
  const style = getComputedStyle(measure);
  const parsedGap = Number.parseFloat(style.columnGap);
  const gap = Number.isFinite(parsedGap) ? parsedGap : 0;
  let childrenWidth = 0;
  const children = measure.children;
  for (let index = 0; index < children.length; index++) {
    const child = children[index];
    if (!(child instanceof HTMLElement)) continue;
    childrenWidth += Math.max(child.offsetWidth, child.scrollWidth);
    if (index > 0) childrenWidth += gap;
  }
  return Math.max(measure.scrollWidth, measure.offsetWidth, childrenWidth);
}

/**
 * Height of the same chips laid out across the whole stage.
 * The visible strip is only as wide as the map, so extra wraps scroll inside
 * this cap instead of pushing the radar up.
 * Keep the fraction: rounding up steals a pixel from the map.
 */
export function aggregatedStripMaxHeight(fullStageHeight: number): number | null {
  if (!Number.isFinite(fullStageHeight) || fullStageHeight <= 0) return null;
  return fullStageHeight;
}

/** Half a pixel of layout noise. A cut inside a row is still a cut. */
const ROW_EDGE_SLACK_PX = 0.5;

export interface AggregatedStripFrame {
  /** Strip border-box height. Sits on a row edge and stays within the cap. */
  height: number;
  /** Extra scroll space so the last resting position starts on a row. */
  tail: number;
  /** Resting scroll offsets. Each one shows whole rows only. */
  snapOffsets: number[];
  /** A later row sits below this window. */
  scrolls: boolean;
}

interface StripFrameInput {
  cap: number;
  rowTops: number[];
  rowBottoms: number[];
  contentEnd: number;
}

function nearEdge(edges: number[], value: number): boolean {
  return edges.some((edge) => Math.abs(edge - value) <= ROW_EDGE_SLACK_PX);
}

function windowCutsRow(
  top: number,
  height: number,
  rowTops: number[],
  rowBottoms: number[],
): boolean {
  const bottom = top + height;
  for (let index = 0; index < rowTops.length; index += 1) {
    const rowTop = rowTops[index] ?? 0;
    const rowBottom = rowBottoms[index] ?? rowTop;
    const overlaps = rowBottom > top + ROW_EDGE_SLACK_PX && rowTop < bottom - ROW_EDGE_SLACK_PX;
    if (!overlaps) continue;
    const fullyInside =
      rowTop >= top - ROW_EDGE_SLACK_PX && rowBottom <= bottom + ROW_EDGE_SLACK_PX;
    if (!fullyInside) return true;
  }
  return false;
}

/**
 * Visible height of a map-column strip.
 * The cap is the full-stage strip, so the map does not get shorter than that.
 * The window ends on a row edge. `tail` lengthens the scroll so the last
 * resting position starts on a row as well, instead of through a chip.
 */
export function aggregatedStripFrame(input: StripFrameInput): AggregatedStripFrame | null {
  const { cap, contentEnd } = input;
  const count = Math.min(input.rowTops.length, input.rowBottoms.length);
  const rowTops = input.rowTops.slice(0, count);
  const rowBottoms = input.rowBottoms.slice(0, count);
  if (!Number.isFinite(cap) || cap <= 0) return null;
  if (count === 0 || rowBottoms.every((bottom) => bottom <= 0)) {
    return { height: cap, tail: 0, snapOffsets: [0], scrolls: false };
  }
  if (contentEnd <= cap) {
    return { height: contentEnd, tail: 0, snapOffsets: [0], scrolls: false };
  }

  let height = 0;
  for (const bottom of rowBottoms) {
    if (bottom <= cap && bottom > height) height = bottom;
  }
  if (height <= 0) return { height: cap, tail: 0, snapOffsets: [0], scrolls: false };

  const allRowsFit = rowBottoms.every((bottom) => bottom <= cap);
  if (allRowsFit) return { height, tail: 0, snapOffsets: [0], scrolls: false };

  // Smallest row start whose window still reaches the end of the chips.
  const coverFrom = contentEnd - height;
  const anchor = rowTops.reduce((best, top) => {
    if (top + ROW_EDGE_SLACK_PX < coverFrom) return best;
    return top < best ? top : best;
  }, Number.POSITIVE_INFINITY);
  const anchorTop = Number.isFinite(anchor) ? anchor : 0;

  const tail = Math.max(0, anchorTop + height - contentEnd);
  const end = contentEnd + tail;
  const edges = [0, end, ...rowTops, ...rowBottoms];
  const candidates = [0, ...rowTops];
  const snapOffsets = candidates.filter((top) => {
    if (top < -ROW_EDGE_SLACK_PX || top > end - height + ROW_EDGE_SLACK_PX) return false;
    if (!nearEdge(edges, top + height) && Math.abs(top + height - end) > ROW_EDGE_SLACK_PX) {
      return false;
    }
    return !windowCutsRow(top, height, rowTops, rowBottoms);
  });
  if (!snapOffsets.some((top) => Math.abs(top) <= ROW_EDGE_SLACK_PX)) snapOffsets.unshift(0);
  if (!snapOffsets.some((top) => Math.abs(top - anchorTop) <= ROW_EDGE_SLACK_PX)) {
    snapOffsets.push(anchorTop);
  }

  return { height, tail, snapOffsets, scrolls: true };
}

/**
 * Split when the unsplit chips are wider than the track. Once split, stay split
 * until the track is wider than the chips by {@link AGGREGATED_ROUND_ROW_SPLIT_HYSTERESIS_PX}.
 * A zero layout size keeps the current choice so a not-yet-laid-out row does not flap.
 */
export function aggregatedRoundRowShouldSplit(
  neededWidth: number,
  availableWidth: number,
  currentlySplit: boolean,
): boolean {
  if (neededWidth <= 0 || availableWidth <= 0) return currentlySplit;
  if (currentlySplit) {
    return neededWidth + AGGREGATED_ROUND_ROW_SPLIT_HYSTERESIS_PX > availableWidth;
  }
  return neededWidth > availableWidth;
}
