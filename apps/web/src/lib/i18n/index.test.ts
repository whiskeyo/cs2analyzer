/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WIN_REASON_BOMB, WIN_REASON_TIME } from "@/lib/shared/constants";
import { UserSettingsProvider } from "@/lib/settings/useUserSettings";
import { clearUserSettingsForTests, saveUserSettings } from "@/lib/settings/userSettingsStore";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_ENDONYMS,
  bombEventLabel,
  catalogFor,
  catalogs,
  en,
  floorLabel,
  interpolateParts,
  isLocale,
  localeEndonym,
  localeTag,
  nadeLabel,
  paletteLabel,
  parseLocale,
  pl,
  roundKindLabel,
  t,
  tNodes,
  useMessages,
  windowKindText,
  winReasonText,
} from "./index";

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

function wrapper({ children }: { children: ReactNode }) {
  return createElement(UserSettingsProvider, null, children);
}

function creditSlots() {
  return {
    version: "1.0.0",
    radarSource: createElement("a", { href: "https://radar.example" }, "cs2-map-icons"),
    weaponMit: createElement("a", { href: "https://mit.example" }, "cs2-killfeed-generator"),
    weaponOther: createElement("a", { href: "https://other.example" }, "counter-strike-icons"),
  };
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

  it("reads FAQ questions from the same keys in both catalogs", () => {
    expect([
      en.faq.whatIs.question,
      en.faq.privacy.question,
      en.faq.whatToDrop.question,
      en.faq.savedNotes.question,
      en.faq.stats.question,
      en.faq.gotvOrPov.question,
      en.faq.browsers.question,
      en.faq.affiliation.question,
      en.faq.preRelease.question,
      en.faq.report.question,
    ]).toEqual([
      "What is CS2 Analyzer?",
      "Do my demos leave this computer?",
      "What can I drop?",
      "How do saved notes work?",
      "What kind of stats are these?",
      "GOTV or POV?",
      "Which browsers work?",
      "Is this affiliated with Valve or FACEIT?",
      "The site says pre-release — should I worry?",
      "How do I report a bug or request a feature?",
    ]);
    expect([
      pl.faq.whatIs.question,
      pl.faq.privacy.question,
      pl.faq.whatToDrop.question,
      pl.faq.savedNotes.question,
      pl.faq.stats.question,
      pl.faq.gotvOrPov.question,
      pl.faq.browsers.question,
      pl.faq.affiliation.question,
      pl.faq.preRelease.question,
      pl.faq.report.question,
    ]).toEqual([
      "Czym jest CS2 Analyzer?",
      "Czy moje dema opuszczają ten komputer?",
      "Co mogę wrzucić?",
      "Jak działają zapisane notatki?",
      "Jakie to statystyki?",
      "GOTV czy POV?",
      "Które przeglądarki działają?",
      "Czy to jest powiązane z Valve albo FACEIT?",
      "Strona pisze pre-release — mam się martwić?",
      "Jak zgłosić buga albo poprosić o funkcję?",
    ]);
  });

  it("does not put math markup or a markdown pipeline in the catalog", () => {
    for (const [path, text] of [...leafEntries(en.faq), ...leafEntries(pl.faq)]) {
      expect(text, path).not.toMatch(/katex|react-markdown|\$\$|<math/i);
    }
  });
});

describe("tNodes", () => {
  it("renders one English credits sentence with named link slots", () => {
    render(createElement("p", null, tNodes(en.credits.attribution, creditSlots())));
    expect(screen.getByRole("paragraph")).toHaveTextContent(
      t(en.credits.attribution, {
        version: "1.0.0",
        radarSource: "cs2-map-icons",
        weaponMit: "cs2-killfeed-generator",
        weaponOther: "counter-strike-icons",
      }),
    );
    expect(screen.getByRole("link", { name: "cs2-map-icons" })).toHaveAttribute(
      "href",
      "https://radar.example",
    );
    expect(screen.getByRole("link", { name: "cs2-killfeed-generator" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "counter-strike-icons" })).toBeInTheDocument();
  });

  it("lets Polish put slots in a different order than English", () => {
    render(createElement("p", null, tNodes(pl.credits.attribution, creditSlots())));
    expect(screen.getByRole("paragraph")).toHaveTextContent(
      t(pl.credits.attribution, {
        version: "1.0.0",
        radarSource: "cs2-map-icons",
        weaponMit: "cs2-killfeed-generator",
        weaponOther: "counter-strike-icons",
      }),
    );
    expect(screen.getByRole("paragraph").textContent).toMatch(
      /^Autor: whiskeyo \(wersja 1\.0\.0\)/,
    );
  });
});

describe("useMessages", () => {
  beforeEach(async () => {
    await clearUserSettingsForTests();
  });

  afterEach(async () => {
    await clearUserSettingsForTests();
  });

  it("defaults to English and switches catalog when locale is pl", async () => {
    const { result } = renderHook(() => useMessages(), { wrapper });
    await waitFor(() => expect(result.current.locale).toBe("en"));
    expect(result.current.messages).toBe(en);
    expect(result.current.t(result.current.messages.header.exportCsv)).toBe("Export CSV");

    await saveUserSettings({ locale: "pl" });
    const polish = renderHook(() => useMessages(), { wrapper });
    await waitFor(() => expect(polish.result.current.locale).toBe("pl"));
    expect(polish.result.current.messages).toBe(pl);
    expect(polish.result.current.messages.header.exportCsv).toBe("Eksportuj CSV");
  });

  it("falls back to English without a settings provider", () => {
    const { result } = renderHook(() => useMessages());
    expect(result.current.locale).toBe("en");
    expect(result.current.messages.nav.faq).toBe(en.nav.faq);
  });

  it("falls unknown stored locale back to English", async () => {
    await saveUserSettings({ locale: "de" as "en" });
    const { result } = renderHook(() => useMessages(), { wrapper });
    await waitFor(() => expect(result.current.locale).toBe("en"));
    expect(result.current.messages).toBe(en);
  });
});

describe("label switches", () => {
  it("maps known codes and falls unknown values back to English-shaped defaults", () => {
    expect(winReasonText(en, WIN_REASON_BOMB)).toBe("Bomb");
    expect(winReasonText(pl, WIN_REASON_TIME)).toBe("Czas");
    expect(winReasonText(en, 0)).toBe("—");
    expect(winReasonText(en, 99)).toBe("#99");
    expect(nadeLabel(en, "smoke")).toBe("Smoke");
    expect(nadeLabel(en, "incendiary")).toBe("Incendiary");
    expect(nadeLabel(en, "molotov")).toBe("Molly");
    expect(bombEventLabel(en, "begin_plant")).toBe("Planting");
    expect(bombEventLabel(pl, "exploded")).toBe("Wybuch");
    expect(windowKindText(en, null)).toBe("Whole round");
    expect(windowKindText(pl, { start: 10, end: 10 })).toBe("Pin");
    expect(paletteLabel(en, "night")).toBe("Night");
    expect(paletteLabel(en, "unknown")).toBe("Neon");
    expect(floorLabel(en, "lower")).toBe("Lower");
    expect(floorLabel(en, "auto")).toBe("Auto");
    expect(roundKindLabel(pl, "eco")).toBe("Eco");
    expect(roundKindLabel(en, "full")).toBe("Full");
  });
});
