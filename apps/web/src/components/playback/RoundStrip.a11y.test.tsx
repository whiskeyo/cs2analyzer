import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { messagesFor } from "@/lib/i18n/catalogs";
import { roundSideBuys } from "@/lib/match/economy";
import { makeReplay, makeRound } from "@/lib/testing/fixtures";
import { UserSettingsProvider } from "@/lib/settings/useUserSettings";
import { clearUserSettingsForTests, saveUserSettings } from "@/lib/settings/userSettingsStore";
import { RoundStrip, roundChipLabel } from "./RoundStrip";

describe("RoundStrip accessible buy line", () => {
  it("announces the same buy line to screen readers in Polish", async () => {
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 2,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
          team_t: "Vitality",
          team_ct: "Astralis",
        }),
      ],
    });
    const round = replay.rounds[0]!;
    const polish = roundChipLabel(
      messagesFor("pl"),
      replay,
      round,
      roundSideBuys(replay, round),
      false,
      true,
    );
    expect(polish).toBe("Runda 2 · T Vitality brak buy · CT Astralis brak buy · notatki");

    const previousLang = document.documentElement.lang;
    await clearUserSettingsForTests();
    await saveUserSettings({ locale: "pl" });
    render(
      <UserSettingsProvider>
        <RoundStrip
          replay={replay}
          tick={100}
          notes={[
            {
              round: 2,
              note: {
                groups: [],
                drawings: [{ type: "pen", color: "#fff", points: [{ x: 0, y: 0 }] }],
                pieces: [],
                bookmarks: [],
              },
            },
          ]}
          places={null}
        />
      </UserSettingsProvider>,
    );
    const chip = await screen.findByRole("listitem", { name: polish });
    expect(chip).toHaveAttribute("title", polish);
    document.documentElement.lang = previousLang;
    await clearUserSettingsForTests();
  });
});
