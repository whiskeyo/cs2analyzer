import { describe, expect, it } from "vitest";
import { en, pl, type ChromeMessages } from "./messages";

function keys(value: unknown, prefix = ""): string[] {
  if (value == null || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("chrome messages", () => {
  it("gives Polish every English key", () => {
    expect(keys(pl)).toEqual(keys(en));
  });

  it("translates the dialog close control", () => {
    expect(en.dialog.close).toBe("Close");
    expect(pl.dialog.close).toBe("Zamknij");
  });

  it("keeps overlay labels in both catalogs", () => {
    const layerKeys = Object.keys(en.layers) as (keyof ChromeMessages["layers"])[];
    for (const key of layerKeys) {
      expect(pl.layers[key].length).toBeGreaterThan(0);
      expect(en.layers[key].length).toBeGreaterThan(0);
    }
  });
});
