import type { SampledPlayer } from "@/lib/replay/sample";
import {
  GEAR_C4,
  GEAR_DECOY,
  GEAR_DEFUSER,
  GEAR_FLASH,
  GEAR_FLASH2,
  GEAR_HE,
  GEAR_HELMET,
  GEAR_KEVLAR,
  GEAR_MOLLY,
  GEAR_SMOKE,
  GEAR_ZEUS,
} from "@/lib/replay/replayTypes";

export interface GearItem {
  name: string;
  title: string;
}

export function gearItems(p: SampledPlayer): GearItem[] {
  const g = p.gear;
  const icons: GearItem[] = [];
  if (g & GEAR_HELMET) icons.push({ name: "helmet", title: "Helmet" });
  else if (g & GEAR_KEVLAR) icons.push({ name: "kevlar", title: "Kevlar" });
  if (g & GEAR_DEFUSER) icons.push({ name: "defuser", title: "Kit" });
  if (g & GEAR_C4) icons.push({ name: "c4", title: "C4" });
  if (g & GEAR_ZEUS) icons.push({ name: "taser", title: "Zeus" });
  if (g & GEAR_HE) icons.push({ name: "hegrenade", title: "HE" });
  if (g & GEAR_FLASH) icons.push({ name: "flashbang", title: "Flash" });
  if (g & GEAR_FLASH2) icons.push({ name: "flashbang", title: "Flash" });
  if (g & GEAR_SMOKE) icons.push({ name: "smokegrenade", title: "Smoke" });
  if (g & GEAR_MOLLY) icons.push({ name: "molotov", title: "Molly" });
  if (g & GEAR_DECOY) icons.push({ name: "decoy", title: "Decoy" });
  return icons;
}

export function mainWeaponId(p: SampledPlayer): number {
  return p.primary || p.secondary;
}

export function sidearmId(p: SampledPlayer): number {
  return p.primary && p.secondary ? p.secondary : 0;
}

export function formatMoney(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}
