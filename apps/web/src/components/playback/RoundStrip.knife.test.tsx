import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { makeReplay, makeRound } from "@/lib/testing/fixtures";
import { RoundStrip } from "./RoundStrip";

describe("RoundStrip knife chip", () => {
  it("labels a stay", async () => {
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 0,
          is_knife: true,
          winner: "CT",
          start_tick: 0,
          end_tick: 100,
          team_ct: "Astralis",
          team_t: "Vitality",
        }),
        makeRound({
          number: 1,
          start_tick: 200,
          end_tick: 900,
          team_ct: "Astralis",
          team_t: "Vitality",
        }),
      ],
    });
    render(<RoundStrip replay={replay} tick={50} notes={[]} places={null} />);
    expect(
      await screen.findByTitle("Knife · won by Astralis (CT) · picked CT (stay)"),
    ).toHaveTextContent("K");
  });

  it("labels a switch", async () => {
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 0,
          is_knife: true,
          winner: "T",
          start_tick: 0,
          end_tick: 100,
          team_ct: "Astralis",
          team_t: "Vitality",
        }),
        makeRound({
          number: 1,
          start_tick: 200,
          end_tick: 900,
          team_ct: "Vitality",
          team_t: "Astralis",
        }),
      ],
    });
    render(<RoundStrip replay={replay} tick={50} notes={[]} places={null} />);
    expect(
      await screen.findByTitle("Knife · won by Vitality (T) · picked CT (switch)"),
    ).toHaveTextContent("K");
  });

  it("names the winner without a side choice when round 1 is missing", async () => {
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 0,
          is_knife: true,
          winner: "CT",
          start_tick: 0,
          end_tick: 100,
          team_ct: "Astralis",
          team_t: "Vitality",
        }),
      ],
    });
    render(<RoundStrip replay={replay} tick={50} notes={[]} places={null} />);
    const chip = await screen.findByTitle("Knife · won by Astralis (CT)");
    expect(chip).toHaveTextContent("K");
    expect(chip.getAttribute("title")).not.toMatch(/stay|switch|undefined|null/);
  });

  it("stays Knife when the round has no winner", async () => {
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 0,
          is_knife: true,
          winner: null,
          start_tick: 0,
          end_tick: 100,
          team_ct: "Astralis",
          team_t: "Vitality",
        }),
        makeRound({ number: 1, start_tick: 200, end_tick: 900 }),
      ],
    });
    render(<RoundStrip replay={replay} tick={50} notes={[]} places={null} />);
    expect(await screen.findByTitle("Knife")).toHaveTextContent("K");
  });
});
