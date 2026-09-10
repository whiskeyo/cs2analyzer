import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ParseTimings, Replay, WorkerOut } from "@/lib/replay/replayTypes";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
  UNIT_CALIBRATION,
} from "@/lib/testing/fixtures";
import { App } from "./App";

vi.mock("@/lib/radar/maps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/radar/maps")>();
  return {
    ...actual,
    loadCalibrations: vi.fn(async () => ({ de_mirage: UNIT_CALIBRATION })),
  };
});

vi.mock("@/components/playbook/PlaybookCanvas", () => ({
  PlaybookCanvas: () => <div data-testid="playbook-canvas" />,
}));

const TIMINGS: ParseTimings = { initMs: 1, parseMs: 2, jsonMs: 3, buffersMs: 4, totalMs: 10 };

/**
 * Stands in for the parse worker so the app can be driven without WASM. The
 * real worker is only reachable in a browser, but everything downstream of the
 * `done` message is the production path.
 */
class FakeWorker {
  onmessage: ((ev: MessageEvent<WorkerOut>) => void) | null = null;
  onerror: ((ev: ErrorEvent) => void) | null = null;
  posted: Promise<void>;
  private resolvePosted!: () => void;

  constructor() {
    this.posted = new Promise((resolve) => {
      this.resolvePosted = resolve;
    });
  }

  postMessage() {
    this.resolvePosted();
  }

  terminate() {}

  emit(msg: WorkerOut) {
    this.onmessage?.({ data: msg } as MessageEvent<WorkerOut>);
  }
}

function fixtureReplay(): Replay {
  return makeReplay({
    header: { team_ct: "Astralis", team_t: "Vitality" },
    players: [
      makePlayer(0, "CT", "Alice"),
      makePlayer(1, "CT", "Bob"),
      makePlayer(2, "T", "Cara"),
      makePlayer(3, "T", "Dan"),
    ],
    rounds: [
      makeRound({ number: 0, is_knife: true, start_tick: 0, end_tick: 100 }),
      makeRound({ number: 1, winner: "CT", start_tick: 200, freeze_end_tick: 264, end_tick: 900 }),
    ],
    ticks: makeFreezeTicks(4, 2, 264),
    kills: [makeKill(400, 0, 2)],
  });
}

/** Drops a demo on the splash and waits for the viewer to come up. */
async function loadDemo(replay: Replay = fixtureReplay()) {
  const workers: FakeWorker[] = [];
  const createWorker = () => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker as unknown as Worker;
  };
  const { container } = render(<App createWorker={createWorker} />);

  const input = container.querySelector(".drop input[type=file]") as HTMLInputElement;
  await userEvent.upload(input, new File(["fake"], "match.dem"));

  const worker = workers[0];
  expect(worker).toBeDefined();
  await worker.posted;
  worker.emit({ type: "done", replay, timings: TIMINGS });
  // Playback settles on the first non-knife freeze end once the effects flush.
  await waitFor(() => expect(hudMeta(container)).toContain("R1"));
  return { worker, container };
}

function hudMeta(container: HTMLElement): string {
  return container.querySelector(".hud-meta")?.textContent ?? "";
}

describe("App", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    document.title = "CS2 Analyzer";
  });

  it("starts on the home page with a drop zone and no Analyzer highlight", () => {
    render(<App createWorker={() => new FakeWorker() as unknown as Worker} />);
    expect(screen.queryByRole("button", { name: "New demo" })).not.toBeInTheDocument();
    expect(screen.getByText(/One Counter-Strike 2/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Watch Counter-Strike 2 demos/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Saved notes")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Analyzer" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Analyzer" })).toHaveAttribute("href", "/analyzer");
    expect(screen.getByRole("button", { name: "New playbook" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pick a map" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Start empty board" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "see the FAQ" })).toHaveAttribute("href", "/faq");
  });

  it("opens a create-playbook dialog from the home plus button", async () => {
    render(<App createWorker={() => new FakeWorker() as unknown as Worker} />);
    await userEvent.click(screen.getByRole("button", { name: "New playbook" }));
    expect(await screen.findByRole("heading", { name: "New playbook" })).toBeInTheDocument();
    expect(await screen.findByRole("combobox", { name: "Map" })).toHaveValue("de_mirage");
    expect(screen.getByRole("textbox", { name: "Playbook title" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("heading", { name: "New playbook" })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("opens FAQ from the home hint", async () => {
    render(<App createWorker={() => new FakeWorker() as unknown as Worker} />);
    await userEvent.click(screen.getByRole("link", { name: "see the FAQ" }));
    expect(window.location.pathname).toBe("/faq");
    expect(await screen.findByRole("heading", { level: 2, name: "FAQ" })).toBeInTheDocument();
    expect(screen.queryByText(/One Counter-Strike 2/)).not.toBeInTheDocument();
  });

  it("shows the parsed match on the radar, HUD, and scoreboard", async () => {
    const { container } = await loadDemo();

    expect(screen.getByText(/match\.dem/)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/analyzer");
    expect(hudMeta(container)).toBe("Anubis · R1");
    expect(screen.getByText("Astralis")).toBeInTheDocument();

    // Both rosters reach the scoreboard, grouped by the side they are on.
    const [ct, t] = container.querySelectorAll(".sb-team");
    expect(within(ct as HTMLElement).getByText("Alice")).toBeInTheDocument();
    expect(within(t as HTMLElement).getByText("Cara")).toBeInTheDocument();
  });

  it("reports a parse failure instead of opening the viewer", async () => {
    const workers: FakeWorker[] = [];
    const createWorker = () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    };
    const { container } = render(<App createWorker={createWorker} />);

    const input = container.querySelector(".drop input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, new File(["fake"], "bad.dem"));
    await workers[0].posted;
    workers[0].emit({ type: "error", message: "Supports only Source 2 replays" });

    expect(await screen.findByText("Supports only Source 2 replays")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/analyzer");
    expect(screen.queryByRole("button", { name: "New demo" })).not.toBeInTheDocument();
  });

  it("returns to Analyzer on New demo", async () => {
    await loadDemo();

    await userEvent.click(screen.getByRole("button", { name: "New demo" }));
    expect(screen.queryByText(/match\.dem/)).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/analyzer");
    expect(screen.getByText(/One Counter-Strike 2/)).toBeInTheDocument();
    expect(screen.getByText(/Notes auto-save/)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Watch Counter-Strike 2 demos/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps the scoreboard selection in step with the radar", async () => {
    const { container } = await loadDemo();
    const ct = container.querySelector(".sb-team") as HTMLElement;

    await userEvent.click(within(ct).getByText("Alice"));
    expect(await screen.findByRole("heading", { name: "Alice" })).toBeInTheDocument();
  });

  it("opens the FAQ from the site nav and returns to Analyzer", async () => {
    render(<App createWorker={() => new FakeWorker() as unknown as Worker} />);
    await userEvent.click(screen.getByRole("link", { name: "FAQ" }));
    expect(await screen.findByRole("heading", { level: 2, name: "FAQ" })).toBeInTheDocument();
    expect(screen.queryByText(/One Counter-Strike 2/)).not.toBeInTheDocument();
    expect(document.title).toBe("FAQ · CS2 Analyzer");

    await userEvent.click(screen.getByRole("link", { name: "Analyzer" }));
    expect(window.location.pathname).toBe("/analyzer");
    expect(screen.getByText(/One Counter-Strike 2/)).toBeInTheDocument();
    expect(screen.getByText(/Notes auto-save/)).toBeInTheDocument();
    expect(document.title).toBe("Analyzer · CS2 Analyzer");
  });

  it("shows FAQ when opened at /faq", async () => {
    window.history.replaceState({}, "", "/faq");
    render(<App createWorker={() => new FakeWorker() as unknown as Worker} />);
    expect(await screen.findByRole("heading", { level: 2, name: "FAQ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps a loaded demo while visiting FAQ", async () => {
    await loadDemo();
    await userEvent.click(screen.getByRole("link", { name: "FAQ" }));
    expect(await screen.findByRole("heading", { level: 2, name: "FAQ" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New demo" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "Analyzer" }));
    expect(screen.getByRole("button", { name: "New demo" })).toBeInTheDocument();
    expect(screen.getByText(/match\.dem/)).toBeInTheDocument();
  });

  it("opens Playbook from the site nav without a demo", async () => {
    render(<App createWorker={() => new FakeWorker() as unknown as Worker} />);
    await userEvent.click(screen.getByRole("link", { name: "Playbook" }));
    expect(window.location.pathname).toBe("/playbook");
    expect(document.title).toBe("Playbook · CS2 Analyzer");
    expect(await screen.findByRole("heading", { name: "Playbooks" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New demo" })).not.toBeInTheDocument();
  });

  it("keeps a loaded demo while visiting Playbook", async () => {
    await loadDemo();
    await userEvent.click(screen.getByRole("link", { name: "Playbook" }));
    expect(await screen.findByRole("heading", { name: "Playbooks" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New demo" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "Analyzer" }));
    expect(screen.getByRole("button", { name: "New demo" })).toBeInTheDocument();
    expect(screen.getByText(/match\.dem/)).toBeInTheDocument();
  });
});
