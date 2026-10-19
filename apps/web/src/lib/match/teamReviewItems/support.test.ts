import { describe, expect, it } from "vitest";
import { teamHeadline } from "./support";

describe("teamHeadline", () => {
  it("keeps the summary and attaches clickable detail lines", () => {
    expect(
      teamHeadline(2, "high", "eco", "Lost 2 anti-eco rounds", [
        { tick: 100, roundLabel: "R4", text: "Lost an anti-eco vs Eco" },
        { tick: 200, roundLabel: "R12", text: "Lost an anti-eco vs Eco" },
      ]),
    ).toEqual([
      {
        count: 2,
        severity: "high",
        kind: "eco",
        text: "Lost 2 anti-eco rounds",
        details: [
          { tick: 100, roundLabel: "R4", text: "Lost an anti-eco vs Eco" },
          { tick: 200, roundLabel: "R12", text: "Lost an anti-eco vs Eco" },
        ],
      },
    ]);
  });

  it("skips empty counts", () => {
    expect(teamHeadline(0, "high", "eco", "Lost 0 anti-eco rounds", [])).toEqual([]);
  });
});
