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
