import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useApp } from "@/lib/state/appState";
import { buildSeries, loadedDemo } from "@/lib/parse/session";
import { makeReplay } from "@/lib/testing/fixtures";
import { SeriesBar } from "./SeriesBar";

vi.mock("@/lib/state/appState", () => ({
  useApp: vi.fn(),
}));

function seriesSession() {
  const a = loadedDemo(
    makeReplay({ header: { map_name: "de_mirage", team_ct: "A", team_t: "B" } }),
    "a.dem",
    new File([], "a.dem"),
  );
  const b = loadedDemo(
    makeReplay({ header: { map_name: "de_mirage", team_ct: "A", team_t: "B" } }),
    "b.dem",
    new File([], "b.dem"),
  );
  const series = buildSeries("de_mirage", [a, b]);
  const selectDemo = vi.fn();
  const setSeriesView = vi.fn();
  return {
    session: {
      series,
      demo: a,
      mapGroups: [{ mapName: "de_mirage", demos: [a, b] }],
      selectedMapName: "de_mirage",
      selectMap: vi.fn(),
      selectDemo,
    },
    habits: {
      aggregated: false,
      setSeriesView,
      demoColors: new Map([[a.id, "#f00"]]),
    },
    selectDemo,
    setSeriesView,
  };
}

describe("SeriesBar", () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
  });

  it("renders nothing without a series bar context", () => {
    vi.mocked(useApp).mockReturnValue({
      session: { series: null, mapGroups: [] },
      habits: { aggregated: false, setSeriesView: vi.fn(), demoColors: new Map() },
    } as unknown as ReturnType<typeof useApp>);
    const { container } = render(<SeriesBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists demo files and the focal team", () => {
    const { session, habits } = seriesSession();
    vi.mocked(useApp).mockReturnValue({ session, habits } as unknown as ReturnType<typeof useApp>);
    render(<SeriesBar />);
    expect(screen.getByText("Series")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "a.dem" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: "b.dem" })).toBeInTheDocument();
  });

  it("selects another demo and toggles aggregated view", async () => {
    const ctx = seriesSession();
    vi.mocked(useApp).mockReturnValue({
      session: ctx.session,
      habits: ctx.habits,
    } as unknown as ReturnType<typeof useApp>);
    render(<SeriesBar />);

    await userEvent.click(screen.getByRole("button", { name: "b.dem" }));
    expect(ctx.selectDemo).toHaveBeenCalledWith(ctx.session.series.demos[1].id);

    await userEvent.click(screen.getByRole("button", { name: "Aggregated" }));
    expect(ctx.setSeriesView).toHaveBeenCalledWith("aggregated");
  });
});
