/**
 * Tick windows over the flat event arrays on a `Replay`.
 *
 * The radar asks "which kills / shots / throws are in this window" on every
 * frame, and each array is thousands of entries long. Sort once per array,
 * cache it against the array's identity (replay arrays never change), then
 * binary search.
 */

const sorted = new WeakMap<object, unknown[]>();

/** Ascending by tick. Cached per array, so the sort happens once per demo. */
export function sortedByTick<T extends object>(items: T[], tickOf: (item: T) => number): T[] {
  const cached = sorted.get(items);
  if (cached) return cached as T[];
  const next = items.slice().sort((a, b) => tickOf(a) - tickOf(b));
  sorted.set(items, next);
  return next;
}

/** First index whose tick is >= `tick`. */
function lowerBound<T>(items: T[], tickOf: (item: T) => number, tick: number): number {
  let lo = 0;
  let hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tickOf(items[mid]) < tick) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Events with `from <= tick <= to`, in tick order. Empty when `to < from`. */
export function inTickWindow<T extends object>(
  items: T[] | undefined,
  tickOf: (item: T) => number,
  from: number,
  to: number,
): T[] {
  if (!items || items.length === 0 || to < from) return [];
  const list = sortedByTick(items, tickOf);
  const start = lowerBound(list, tickOf, from);
  const out: T[] = [];
  for (let i = start; i < list.length && tickOf(list[i]) <= to; i++) out.push(list[i]);
  return out;
}

/** Events at or before `tick`, in tick order. */
export function upToTick<T extends object>(
  items: T[] | undefined,
  tickOf: (item: T) => number,
  tick: number,
): T[] {
  if (!items || items.length === 0) return [];
  const list = sortedByTick(items, tickOf);
  return list.slice(0, lowerBound(list, tickOf, tick + 1));
}
