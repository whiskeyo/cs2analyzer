import { useEffect, useRef } from "react";
import { NADE_WEAPON } from "@/lib/match/roundEvents";
import type { NadeIcons } from "@/lib/radar/draw";
import { radarUrl } from "@/lib/radar/maps";
import type { GrenadeKind, MapCalibration } from "@/lib/replay/replayTypes";
import { publicUrl } from "@/lib/shared/publicUrl";
import { weaponIconSrc } from "@/lib/weapons/weapons";

export function useRadarImages(cal: MapCalibration | undefined) {
  const images = useRef<{ upper: HTMLImageElement | null; lower: HTMLImageElement | null }>({
    upper: null,
    lower: null,
  });
  const c4Icon = useRef<HTMLImageElement | null>(null);
  const nadeIcons = useRef<NadeIcons>({});

  useEffect(() => {
    const pack = new Image();
    pack.src = publicUrl("weapons/c4.svg");
    pack.onload = () => {
      c4Icon.current = pack;
    };
    for (const kind of Object.keys(NADE_WEAPON) as GrenadeKind[]) {
      const src = weaponIconSrc(NADE_WEAPON[kind]);
      if (!src) continue;
      const nade = new Image();
      nade.src = src;
      nade.onload = () => {
        nadeIcons.current[kind] = nade;
      };
    }
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

  return { images, c4Icon, nadeIcons };
}
