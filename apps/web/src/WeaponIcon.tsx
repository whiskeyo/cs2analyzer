import { prettyWeapon, WEAPON_BY_ID, weaponIconSrc } from "./weapons";

interface Props {
  weapon: string | number;
  className?: string;
  title?: string;
}

export function WeaponIcon({ weapon, className = "", title }: Props) {
  const src = weaponIconSrc(weapon);
  const label =
    title ??
    (typeof weapon === "number" ? prettyWeapon(WEAPON_BY_ID[weapon] ?? "") : prettyWeapon(weapon));
  if (!src) {
    if (typeof weapon === "number") return null;
    return <span className={`wep-fallback ${className}`.trim()}>{prettyWeapon(weapon)}</span>;
  }
  return <img className={`wep-icon ${className}`.trim()} src={src} alt={label} title={label} />;
}

export function GearIcon({ name, title }: { name: string; title?: string }) {
  return <img className="wep-icon gear" src={`/weapons/${name}.svg`} alt={title ?? name} title={title ?? name} />;
}
