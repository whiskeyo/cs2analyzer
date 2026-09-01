import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useApp } from "@/lib/state/appState";
import { buildSeries, loadedDemo } from "@/lib/parse/session";
import { makeReplay } from "@/lib/testing/fixtures";
import { SeriesFilters } from "./SeriesFilters";

vi.mock("@/lib/state/appState", () => ({
  useApp: vi.fn(),
}));

function multiDemoHabits() {
  const a = loadedDemo(
    makeReplay({ header: { team_ct: "Astralis", team_t: "Vitality" } }),
    "a.dem",
    new File([], "a.dem"),
  );
  const b = loadedDemo(
    makeReplay({ header: { team_ct: "Astralis", team_t: "Vitality" } }),
    "b.dem",
    new File([], "b.dem"),
  );
  const series = buildSeries("de_mirage", [a, b]);
  const setFocalTeam = vi.fn();
  const setSide = vi.fn();
  const setKind = vi.fn();
  const setPlayerKey = vi.fn();
  const setOverlayOn = vi.fn();
  const setSeriesView = vi.fn();
  return {
    session: { series, setFocalTeam },
    habits: {
      filter: { side: "CT" as const, kind: "full" as const },
      overlayOn: false,
      focalPlayers: [],
      playerKey: null,
      aggregated: false,
      bucketOverlay: null,
      overlay: null,
      overlayArrows: false,
      overlayTrails: true,
      overlayDisplay: "trails" as const,
      nadeFilter: { smoke: true, molotov: true, flash: true, he: true },
      nadesOn: true,
      nadeOpacity: 0.8,
      bucketPlaySec: 0,
      setSide,
      setKind,
      setPlayerKey,
      setOverlayOn,
      setOverlayArrows: vi.fn(),
      setOverlayTrails: vi.fn(),
      setOverlayDisplay: vi.fn(),
      setNadeKind: vi.fn(),
      setNadesOn: vi.fn(),
      setNadeOpacity: vi.fn(),
      setSeriesView,
      demoColors: new Map(),
    },
  };
}

describe("SeriesFilters", () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
  });

  it("renders nothing for a single-demo series", () => {
    const demo = loadedDemo(makeReplay(), "solo.dem", new File([], "solo.dem"));
    vi.mocked(useApp).mockReturnValue({
      session: { series: buildSeries("de_mirage", [demo]) },
      habits: multiDemoHabits().habits,
    } as unknown as ReturnType<typeof useApp>);
    const { container } = render(<SeriesFilters />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows team, side, and buy filters for multi-demo", () => {
    const { session, habits } = multiDemoHabits();
    vi.mocked(useApp).mockReturnValue({ session, habits } as unknown as ReturnType<typeof useApp>);
    render(<SeriesFilters />);
    expect(screen.getByLabelText("Focal team for habits")).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Habits side" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Full" })).toHaveClass("on");
  });

  it("calls habits setters when filters change", async () => {
    const { session, habits } = multiDemoHabits();
    vi.mocked(useApp).mockReturnValue({ session, habits } as unknown as ReturnType<typeof useApp>);
    render(<SeriesFilters />);

    await userEvent.click(screen.getByRole("button", { name: "T" }));
    expect(habits.setSide).toHaveBeenCalledWith("T");

    await userEvent.click(screen.getByRole("button", { name: "Eco" }));
    expect(habits.setKind).toHaveBeenCalledWith("eco");
  });
});
