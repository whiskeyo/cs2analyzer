import { useEffect, useState } from "react";
import { loadPlaybookImageBitmaps } from "./playbookImageBitmaps";

export function usePlaybookImageBitmaps(
  ids: readonly string[],
): ReadonlyMap<string, HTMLImageElement> {
  const [bitmaps, setBitmaps] = useState<Map<string, HTMLImageElement>>(() => new Map());
  const key = ids.join(",");

  useEffect(() => {
    let cancelled = false;
    const wanted = key === "" ? [] : key.split(",");
    void loadPlaybookImageBitmaps(wanted).then((next) => {
      if (!cancelled) setBitmaps(next);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return bitmaps;
}
