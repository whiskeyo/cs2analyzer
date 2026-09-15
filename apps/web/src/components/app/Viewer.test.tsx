import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useApp } from "@/lib/state/appState";
import type { ParseFileProgress } from "@/lib/parse/parsePool";
import { buildSeries, loadedDemo } from "@/lib/parse/session";
import { makeReplay } from "@/lib/testing/fixtures";
import { Viewer } from "./Viewer";

vi.mock("@/lib/state/appState", () => ({
  useApp: vi.fn(),
}));

vi.mock("./SeriesBar", () => ({
  SeriesBar: () => <div data-testid="series-bar" />,
}));
vi.mock("./SeriesFilters", () => ({
  SeriesFilters: () => <div data-testid="series-filters" />,
}));
vi.mock("@/components/radar/RadarStage", () => ({
  RadarStage: () => <div data-testid="radar-stage" />,
}));
vi.mock("@/components/sidebar/Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));
vi.mock("@/components/playback/RoundStrip", () => ({
  RoundStrip: () => <div data-testid="round-strip" />,
}));
vi.mock("@/components/playback/SeriesAggregatedRoundStrip", () => ({
  SeriesAggregatedRoundStrip: () => <div data-testid="aggregated-round-strip" />,
}));
vi.mock("@/components/playback/BucketControls", () => ({
  BucketControls: () => <div data-testid="bucket-controls" />,
}));
vi.mock("@/components/playback/Controls", () => ({
  Controls: () => <div data-testid="controls" />,
}));

function viewerState(replay = makeReplay()) {
  return {
    session: {
      replay,
      series: null,
      demo: null,
      switching: false,
      parsing: false,
      progress: null as { current: number; total: number } | null,
      parseFiles: null as ParseFileProgress[] | null,
      cancelParse: vi.fn(),
    },
    appendFiles: vi.fn(),
    status: { error: null as string | null, notice: null as string | null },
    playback: {
      tick: 0,
      jump: vi.fn(),
      playing: false,
      speed: 1,
      setPlaying: vi.fn(),
      scrub: vi.fn(),
      setSpeed: vi.fn(),
      roundAutoplay: false,
      setRoundAutoplay: vi.fn(),
    },
    review: { notes: [], commitNotes: vi.fn() },
    view: { selected: null, select: vi.fn() },
    places: null,
    habits: {
      aggregated: false,
      overlay: null,
      overlayOn: false,
      bucketOverlay: null,
      bucketPlaySec: 0,
      bucketWindowSec: 5,
      bucketPlaySecRef: { current: 0 },
      setBucketPlaySec: vi.fn(),
      seriesRoundsByKind: [],
      demoColors: new Map(),
      selectBucketOverlay: vi.fn(),
      playRound: vi.fn(),
    },
  };
}

describe("Viewer", () => {
  beforeEach(() => {
    vi.mocked(useApp).mockReset();
  });

  it("renders nothing without a loaded replay", () => {
    vi.mocked(useApp).mockReturnValue({
      session: { replay: null, series: null, switching: false },
      playback: { playing: false, speed: 1, setPlaying: vi.fn(), tick: 0 },
      habits: {
        bucketPlaySecRef: { current: 0 },
        setBucketPlaySec: vi.fn(),
        bucketWindowSec: 5,
      },
    } as unknown as ReturnType<typeof useApp>);
    const { container } = render(<Viewer />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the viewer shell when a replay is loaded", () => {
    vi.mocked(useApp).mockReturnValue(viewerState() as unknown as ReturnType<typeof useApp>);
    render(<Viewer />);
    expect(screen.getByTestId("radar-stage")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("round-strip")).toBeInTheDocument();
    expect(screen.getByTestId("controls")).toBeInTheDocument();
    expect(screen.getByText(/Space play/)).toBeInTheDocument();
  });

  it("shows bucket controls in aggregated overlay mode", () => {
    const replay = makeReplay();
    const series = buildSeries("de_mirage", [
      loadedDemo(replay, "a.dem", new File([], "a.dem")),
      loadedDemo(replay, "b.dem", new File([], "b.dem")),
    ]);
    const base = viewerState(replay);
    vi.mocked(useApp).mockReturnValue({
      ...base,
      session: { ...base.session, series, demo: series.demos[0] },
      habits: {
        ...base.habits,
        aggregated: true,
        overlayOn: true,
        bucketOverlay: { side: "CT", kind: "full" },
      },
    } as unknown as ReturnType<typeof useApp>);
    render(<Viewer />);
    expect(screen.getByTestId("aggregated-round-strip")).toBeInTheDocument();
    expect(screen.getByTestId("bucket-controls")).toBeInTheDocument();
    expect(screen.queryByTestId("round-strip")).not.toBeInTheDocument();
    expect(screen.queryByTestId("controls")).not.toBeInTheDocument();
  });

  it("shows series chrome when a multi-demo series is loaded", () => {
    const state = viewerState();
    state.session.series = { demos: [{}, {}] } as never;
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<Viewer />);
    expect(screen.getByTestId("series-bar")).toBeInTheDocument();
    expect(screen.getByTestId("series-filters")).toBeInTheDocument();
  });

  it("shows a switching placeholder while demos swap", () => {
    const state = viewerState();
    state.session.switching = true;
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<Viewer />);
    expect(screen.getByText("Switching demo…")).toBeInTheDocument();
    expect(screen.queryByTestId("radar-stage")).not.toBeInTheDocument();
  });

  it("shows append progress and Cancel without leaving the viewer", async () => {
    const cancelParse = vi.fn();
    const state = viewerState();
    state.session.parsing = true;
    state.session.progress = { current: 40, total: 100 };
    state.session.parseFiles = [{ name: "extra.dem", index: 0, state: "parsing", pct: 40 }];
    state.session.cancelParse = cancelParse;
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<Viewer />);
    expect(screen.getByTestId("radar-stage")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel parse" }));
    expect(cancelParse).toHaveBeenCalledOnce();
  });

  it("appends a dropped demo instead of replacing the session", async () => {
    const state = viewerState();
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    const { container } = render(<Viewer />);
    const viewer = container.querySelector(".viewer") as HTMLElement;
    fireEvent.drop(viewer, { dataTransfer: { files: [new File(["fake"], "extra.dem")] } });
    await waitFor(() =>
      expect(state.appendFiles).toHaveBeenCalledWith([
        expect.objectContaining({ name: "extra.dem" }),
      ]),
    );
  });

  it("hints that a drag will add to the open session", () => {
    const state = viewerState();
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    const { container } = render(<Viewer />);
    const viewer = container.querySelector(".viewer") as HTMLElement;
    fireEvent.dragEnter(viewer);
    expect(screen.getByText("Drop to add this demo to the open session")).toBeInTheDocument();
    expect(viewer).toHaveClass("is-drop-target");
  });

  it("shows the last parse notice on the loaded viewer", () => {
    const state = viewerState();
    state.status.notice = "Series: 2 de_mirage demos · NaVi";
    vi.mocked(useApp).mockReturnValue(state as unknown as ReturnType<typeof useApp>);
    render(<Viewer />);
    expect(screen.getByText("Series: 2 de_mirage demos · NaVi")).toBeInTheDocument();
  });
});
