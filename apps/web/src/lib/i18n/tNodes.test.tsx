/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { en } from "./translations/en";
import { pl } from "./translations/pl";
import { t, tNodes } from "./messages";

describe("tNodes", () => {
  it("renders one English credits sentence with named link slots", () => {
    render(
      <p>
        {tNodes(en.credits.attribution, {
          version: "1.0.0",
          radarSource: <a href="https://radar.example">cs2-map-icons</a>,
          weaponMit: <a href="https://mit.example">cs2-killfeed-generator</a>,
          weaponOther: <a href="https://other.example">counter-strike-icons</a>,
        })}
      </p>,
    );
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
    render(
      <p>
        {tNodes(pl.credits.attribution, {
          version: "1.0.0",
          radarSource: <a href="https://radar.example">cs2-map-icons</a>,
          weaponMit: <a href="https://mit.example">cs2-killfeed-generator</a>,
          weaponOther: <a href="https://other.example">counter-strike-icons</a>,
        })}
      </p>,
    );
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
