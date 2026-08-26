import { gearItems } from "@/lib/weapons/loadout";
import type { SampledPlayer } from "@/lib/replay/sample";
import { GearIcon, WeaponIcon } from "@/components/weapons/WeaponIcon";

export function LoadoutIcons({ p }: { p: SampledPlayer }) {
  return (
    <span className="eco-gear">
      {p.primary > 0 && <WeaponIcon weapon={p.primary} />}
      {p.secondary > 0 && <WeaponIcon weapon={p.secondary} />}
      {gearItems(p).map((ic, i) => (
        <GearIcon key={`${ic.name}-${i}`} name={ic.name} title={ic.title} />
      ))}
    </span>
  );
}
