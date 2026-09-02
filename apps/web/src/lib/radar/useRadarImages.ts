import { useEffect, useRef } from "react";
import { radarUrl } from "@/lib/radar/maps";
import { publicUrl } from "@/lib/shared/publicUrl";
import type { MapCalibration } from "@/lib/replay/replayTypes";

export function useRadarImages(cal: MapCalibration | undefined) {
  const images = useRef<{ upper: HTMLImageElement | null; lower: HTMLImageElement | null }>({
    upper: null,
    lower: null,
  });
  const c4Icon = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = publicUrl("weapons/c4.svg");
    img.onload = () => {
      c4Icon.current = img;
    };
  }, []);

  useEffect(() => {
    images.current = { upper: null, lower: null };
    if (!cal) return;
    const up = new Image();
    up.src = radarUrl(cal.radar);
    up.onload = () => {
      images.current.upper = up;
    };
    if (cal.lower_radar) {
      const lo = new Image();
      lo.src = radarUrl(cal.lower_radar);
      lo.onload = () => {
        images.current.lower = lo;
      };
    }
  }, [cal]);

  return { images, c4Icon };
}
