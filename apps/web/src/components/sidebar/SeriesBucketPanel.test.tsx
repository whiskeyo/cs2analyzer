import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useApp } from "@/lib/state/appState";
import { buildSeries, loadedDemo } from "@/lib/parse/session";
import { makeReplay } from "@/lib/testing/fixtures";
import { SeriesBucketPanel } from "./SeriesBucketPanel";

vi.mock("@/lib/state/appState", () => ({
  useApp: vi.fn(),
}));

function multiSeries() {
  const demoA = loadedDemo(makeReplay(), "a.dem", new File([], "a.dem"));
  const demoB = loadedDemo(makeReplay(), "b.dem", new File([], "b.dem"));
  return buildSeries("de_mirage", [demoA, demoB], "Team A");
}

function habitsState(overrides: Record<string, unknown> = {}) {
  return {
    session: { series: multiSeries() },
    habits: {
      filter: { side: "CT", kind: "full" },
      util: {
        roundCount: 3,
        entries: [{ kind: "smoke" as const, callout: "A site", count: 2 }],
      },
      utilSets: {
        roundCount: 3,
        entries: [{ key: "a-smokes", label: "A smokes", count: 2 }],
      },
      action: {
        roundCount: 2,
        entries: [{ title: "A execute", count: 1 }],
      },
      ...overrides,
    },
  };
}

describe("SeriesBucketPanel", () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
  });

  it("renders nothing for a single demo", () => {
    vi.mocked(useApp).mockReturnValue({
      session: { series: null },
      habits: habitsState().habits,
    } as unknown as ReturnType<typeof useApp>);
    const { container } = render(<SeriesBucketPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists util sets, util frequency, and action beats", () => {
    vi.mocked(useApp).mockReturnValue(habitsState() as unknown as ReturnType<typeof useApp>);
    render(<SeriesBucketPanel />);

    expect(screen.getByText(/Team A · CT full/)).toBeInTheDocument();
    expect(screen.getByText(/3 rounds/)).toBeInTheDocument();
    expect(screen.getByText("A smokes")).toBeInTheDocument();
    expect(screen.getAllByText("2/3").length).toBeGreaterThan(0);
    expect(screen.getByText(/Smoke A site/)).toBeInTheDocument();
    expect(screen.getByText("A execute")).toBeInTheDocument();
  });

  it("shows an empty hint when the bucket has no rounds", () => {
    vi.mocked(useApp).mockReturnValue(
      habitsState({
        util: { roundCount: 0, entries: [] },
        utilSets: null,
        action: null,
      }) as unknown as ReturnType<typeof useApp>,
    );
    render(<SeriesBucketPanel />);
    expect(screen.getByText(/No rounds in this bucket across the series/)).toBeInTheDocument();
  });
});
