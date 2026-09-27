import { describe, expect, it } from "vitest";
import { messagesFor } from "./catalogs";
import { parseLocale } from "./locales";
import { translate } from "./translate";

describe("translate", () => {
  it("fills named placeholders and leaves unknown ones", () => {
    expect(translate("Round {number} · {side}", { number: 2, side: "T" })).toBe("Round 2 · T");
    expect(translate("Round {number}", { side: "T" })).toBe("Round {number}");
    expect(translate("Knife")).toBe("Knife");
  });

  it("reads Polish round-strip copy from the catalog", () => {
    const copy = messagesFor("pl").roundStrip;
    expect(translate(copy.round, { number: 2 })).toBe("Runda 2");
    expect(translate(copy.sideTeamBuy, { side: "T", team: "Vitality", buy: copy.eco })).toBe(
      "T Vitality eco",
    );
    expect(copy.noBuy).toBe("brak buy");
    expect(copy.knife).toBe("Nóż");
    expect(copy.notes).toBe("notatki");
    expect(copy.tutorialInactive).toBe("niedostępne w samouczku");
  });
});

describe("parseLocale", () => {
  it("keeps en and pl and falls back otherwise", () => {
    expect(parseLocale("pl")).toBe("pl");
    expect(parseLocale("en")).toBe("en");
    expect(parseLocale("de")).toBe("en");
    expect(parseLocale(undefined)).toBe("en");
  });
});
