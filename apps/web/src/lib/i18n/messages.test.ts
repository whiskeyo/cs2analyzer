import { describe, expect, it } from "vitest";
import { catalogs } from "./catalogs";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_ENDONYMS,
  isLocale,
  localeEndonym,
  localeTag,
  parseLocale,
} from "./locales";
import { catalogFor } from "./catalogs";
import { interpolateParts, t } from "./messages";
import { en } from "./translations/en";
import { pl } from "./translations/pl";

function leafEntries(value: unknown, prefix = ""): [string, string][] {
  if (typeof value === "string") {
    return [[prefix, value]];
  }
  if (value == null || typeof value !== "object") {
    return [];
  }
  const out: [string, string][] = [];
  for (const [key, nested] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    out.push(...leafEntries(nested, path));
  }
  return out;
}

describe("locales", () => {
  it("defaults to English and rejects unknown codes", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALES).toEqual(["en", "pl"]);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("pl")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(parseLocale("pl")).toBe("pl");
    expect(parseLocale("de")).toBe("en");
    expect(parseLocale(undefined)).toBe("en");
    expect(localeTag("en")).toBe("en-US");
    expect(localeTag("pl")).toBe("pl-PL");
    expect(localeTag("de" as (typeof LOCALES)[number])).toBe("en-US");
    expect(localeEndonym("en")).toBe("English");
    expect(localeEndonym("pl")).toBe("Polski");
    expect(LOCALES.map((code) => LOCALE_ENDONYMS[code])).toEqual(["English", "Polski"]);
    expect(catalogFor("pl")).toBe(pl);
    expect(catalogFor("en")).toBe(en);
    expect(catalogFor("de" as (typeof LOCALES)[number])).toBe(en);
  });
});

describe("t", () => {
  it("replaces named placeholders", () => {
    expect(t("Hello {name}", { name: "Tomasz" })).toBe("Hello Tomasz");
    expect(t("Overall {pct}%", { pct: 61 })).toBe("Overall 61%");
    expect(t(en.credits.attribution, { version: "1.2.3" })).toContain("Version: 1.2.3");
    expect(t(pl.credits.attribution, { version: "1.2.3" })).toContain("wersja 1.2.3");
  });

  it("leaves unknown placeholders and ignores extra vars", () => {
    expect(t("Hello {name}", { other: "x" })).toBe("Hello {name}");
    expect(t("Hi", { extra: 1 })).toBe("Hi");
    expect(t("{a} {b}", { a: "1" })).toBe("1 {b}");
  });

  it("does not treat dollar signs in values as replace patterns", () => {
    expect(t("Cost {price}", { price: "$1,234" })).toBe("Cost $1,234");
  });
});

describe("interpolateParts", () => {
  it("keeps slot objects so locales can reorder around them", () => {
    const radar = { href: "radar" };
    const weapon = { href: "weapon" };
    expect(
      interpolateParts("from {radarSource}, then {weaponMit}", {
        radarSource: radar,
        weaponMit: weapon,
      }),
    ).toEqual(["from ", radar, ", then ", weapon]);
    expect(
      interpolateParts("{weaponMit} oraz {radarSource} ({version})", {
        radarSource: radar,
        weaponMit: weapon,
        version: "9",
      }),
    ).toEqual([weapon, " oraz ", radar, " (", "9", ")"]);
  });
});

describe("catalogs", () => {
  it("ships English and Polish with the same non-empty keys", () => {
    const enLeaves = leafEntries(en);
    const plLeaves = Object.fromEntries(leafEntries(pl));
    expect(enLeaves.length).toBeGreaterThan(0);
    expect(catalogs.en).toBe(en);
    expect(catalogs.pl).toBe(pl);
    for (const [path, english] of enLeaves) {
      expect(english.length, path).toBeGreaterThan(0);
      const polish = plLeaves[path];
      expect(polish, path).toEqual(expect.any(String));
      expect(polish.length, path).toBeGreaterThan(0);
    }
  });

  it("keeps linked sentences as one string with named slots", () => {
    for (const slot of ["{version}", "{radarSource}", "{weaponMit}", "{weaponOther}"] as const) {
      expect(en.credits.attribution).toContain(slot);
      expect(pl.credits.attribution).toContain(slot);
    }
    expect(en.home.faqHint).toContain("{faqLink}");
    expect(pl.home.faqHint).toContain("{faqLink}");
    expect(en.drop.blurb).toContain("{dem}");
    expect(pl.drop.blurb).toContain("{dem}");
    expect(en.drop.savedLead).toContain("{dem}");
    expect(pl.drop.restoreBody).toContain("{file}");
    expect(en.faq.whatToDrop.body).toContain("{dem}");
    expect(pl.faq.savedNotes.body).toContain("{dem}");
    expect(en.faq.report.body).toContain("{issues}");
    expect(pl.faq.report.body).toContain("{issues}");
    expect(en.credits).not.toHaveProperty("weaponsFrom");
    expect(en.home).not.toHaveProperty("faqHintBefore");
    expect(en.drop).not.toHaveProperty("blurbBefore");
    expect(en.drop).not.toHaveProperty("restoreBefore");
  });
});
