import {
  WIN_REASON_BOMB,
  WIN_REASON_CT_ELIM,
  WIN_REASON_CT_SURRENDER,
  WIN_REASON_DEFUSE,
  WIN_REASON_DRAW,
  WIN_REASON_TIME,
  WIN_REASON_T_ELIM,
  WIN_REASON_T_SURRENDER,
} from "@/lib/shared/constants";
import { publicUrl } from "@/lib/shared/publicUrl";

const NAMES: Record<string, string> = {
  ak47: "AK-47",
  m4a1: "M4A4",
  m4a1_silencer: "M4A1-S",
  m4a1_silencer_off: "M4A1-S",
  m4a4: "M4A4",
  awp: "AWP",
  deagle: "Desert Eagle",
  revolver: "R8",
  glock: "Glock",
  usp_silencer: "USP-S",
  usp_silencer_off: "USP-S",
  hkp2000: "P2000",
  elite: "Dualies",
  p250: "P250",
  tec9: "Tec-9",
  fiveseven: "Five-SeveN",
  cz75a: "CZ75",
  mac10: "MAC-10",
  mp9: "MP9",
  mp7: "MP7",
  mp5sd: "MP5-SD",
  ump45: "UMP-45",
  p90: "P90",
  bizon: "PP-Bizon",
  galilar: "Galil",
  famas: "FAMAS",
  ssg08: "SSG 08",
  aug: "AUG",
  sg556: "SG 553",
  scar20: "SCAR-20",
  g3sg1: "G3SG1",
  nova: "Nova",
  xm1014: "XM1014",
  mag7: "MAG-7",
  sawedoff: "Sawed-Off",
  m249: "M249",
  negev: "Negev",
  hegrenade: "HE",
  inferno: "Molly",
  molotov: "Molly",
  incgrenade: "Incendiary",
  flashbang: "Flash",
  smokegrenade: "Smoke",
  decoy: "Decoy",
  knife: "Knife",
  knifegg: "Knife",
  bayonet: "Knife",
  taser: "Zeus",
  c4: "C4",
  kevlar: "Kevlar",
  helmet: "Helmet",
  defuser: "Kit",
};

/** Must stay aligned with `crates/cs2analyzer/src/inventory.rs` weapon ids. */
export const WEAPON_BY_ID = [
  "",
  "knife",
  "taser",
  "c4",
  "glock",
  "usp_silencer",
  "hkp2000",
  "elite",
  "p250",
  "tec9",
  "fiveseven",
  "cz75a",
  "deagle",
  "revolver",
  "mac10",
  "mp9",
  "mp7",
  "mp5sd",
  "ump45",
  "p90",
  "bizon",
  "galilar",
  "famas",
  "ak47",
  "m4a1",
  "m4a1_silencer",
  "ssg08",
  "aug",
  "sg556",
  "awp",
  "scar20",
  "g3sg1",
  "nova",
  "xm1014",
  "mag7",
  "sawedoff",
  "m249",
  "negev",
  "hegrenade",
  "flashbang",
  "smokegrenade",
  "molotov",
  "incgrenade",
  "decoy",
  "kevlar",
  "helmet",
  "defuser",
] as const;

const ICON_ALIAS: Record<string, string> = {
  m4a4: "m4a1",
  usp_silencer_off: "usp_silencer",
  m4a1_silencer_off: "m4a1_silencer",
  inferno: "molotov",
  planted_c4: "planted_c4",
  plantedc4: "planted_c4",
  knifegg: "knife",
  bayonet: "knife",
  galil: "galilar",
  sg553: "sg556",
  zeus: "taser",
};

const ICON_FILES = new Set([
  "ak47",
  "attacker_airborne",
  "attacker_blind",
  "aug",
  "awp",
  "bizon",
  "c4",
  "cz75a",
  "deagle",
  "decoy",
  "defuser",
  "elite",
  "famas",
  "fiveseven",
  "flashbang",
  "flashbang_assist",
  "g3sg1",
  "galilar",
  "glock",
  "hegrenade",
  "headshot",
  "helmet",
  "hkp2000",
  "incgrenade",
  "inferno",
  "kevlar",
  "knife",
  "m249",
  "m4a1",
  "m4a1_silencer",
  "mac10",
  "mag7",
  "molotov",
  "mp5sd",
  "mp7",
  "mp9",
  "negev",
  "noscope",
  "nova",
  "p250",
  "p90",
  "planted_c4",
  "revolver",
  "sawedoff",
  "scar20",
  "sg556",
  "smokegrenade",
  "ssg08",
  "taser",
  "tec9",
  "through_smoke",
  "ump45",
  "usp_silencer",
  "wallbang",
  "xm1014",
]);

export function prettyWeapon(raw: string): string {
  const w = raw.toLowerCase().replace(/^weapon_/, "");
  if (NAMES[w]) return NAMES[w];
  if (
    w.includes("knife") ||
    w.includes("bayonet") ||
    w.includes("karambit") ||
    w.includes("kukri")
  ) {
    return "Knife";
  }
  return raw.replace(/^weapon_/i, "").replace(/_/g, " ");
}

export function weaponKey(raw: string): string | null {
  let w = raw
    .toLowerCase()
    .replace(/^weapon_/, "")
    .replace(/\s+/g, "_");
  if (!w || w === "world" || w === "trigger_hurt") return null;
  if (ICON_ALIAS[w]) w = ICON_ALIAS[w];
  if (
    w.includes("knife") ||
    w.includes("bayonet") ||
    w.includes("karambit") ||
    w.includes("kukri") ||
    w.includes("butterfly")
  ) {
    return "knife";
  }
  return ICON_FILES.has(w) ? w : null;
}

export function weaponIconSrc(raw: string | number): string | null {
  if (typeof raw === "number") {
    const key = WEAPON_BY_ID[raw];
    return key ? publicUrl(`weapons/${key}.svg`) : null;
  }
  const key = weaponKey(raw);
  return key ? publicUrl(`weapons/${key}.svg`) : null;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function prettyMap(mapName: string): string {
  const name =
    mapName
      .split("/")
      .pop()
      ?.replace(/_scrimmagemap$/, "") ?? mapName;
  const labels: Record<string, string> = {
    de_dust2: "Dust II",
    de_mirage: "Mirage",
    de_inferno: "Inferno",
    de_nuke: "Nuke",
    de_overpass: "Overpass",
    de_ancient: "Ancient",
    de_anubis: "Anubis",
    de_vertigo: "Vertigo",
    de_train: "Train",
    de_cache: "Cache",
    de_tuscan: "Tuscan",
    cs_office: "Office",
    cs_italy: "Italy",
  };
  return labels[name] ?? name.replace(/^de_/, "").replace(/_/g, " ");
}

export function winReasonLabel(code: number): string {
  switch (code) {
    case WIN_REASON_BOMB:
      return "Bomb";
    case WIN_REASON_DEFUSE:
      return "Defuse";
    case WIN_REASON_CT_ELIM:
      return "CT elim";
    case WIN_REASON_T_ELIM:
      return "T elim";
    case WIN_REASON_DRAW:
      return "Draw";
    case WIN_REASON_TIME:
      return "Time";
    case WIN_REASON_T_SURRENDER:
      return "T surrender";
    case WIN_REASON_CT_SURRENDER:
      return "CT surrender";
    default:
      return code ? `#${code}` : "—";
  }
}
