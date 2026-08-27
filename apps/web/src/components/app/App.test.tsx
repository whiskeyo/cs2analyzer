import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ParseTimings, Replay, WorkerOut } from "@/lib/replay/replayTypes";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { App } from "./App";

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

  const input = container.querySelector("input[type=file]") as HTMLInputElement;
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
  it("starts on the splash and asks for a demo", () => {
    render(<App createWorker={() => new FakeWorker() as unknown as Worker} />);
    expect(screen.queryByRole("button", { name: "New demo" })).not.toBeInTheDocument();
    expect(screen.getByText(/Drop a Counter-Strike 2/)).toBeInTheDocument();
  });

  it("shows the parsed match on the radar, HUD, and scoreboard", async () => {
    const { container } = await loadDemo();

    expect(screen.getByText(/match\.dem/)).toBeInTheDocument();
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

    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, new File(["fake"], "bad.dem"));
    await workers[0].posted;
    workers[0].emit({ type: "error", message: "Supports only Source 2 replays" });

    expect(await screen.findByText("Supports only Source 2 replays")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New demo" })).not.toBeInTheDocument();
  });

  it("returns to the splash on New demo", async () => {
    await loadDemo();

    await userEvent.click(screen.getByRole("button", { name: "New demo" }));
    expect(screen.queryByText(/match\.dem/)).not.toBeInTheDocument();
    expect(screen.getByText(/Drop a Counter-Strike 2/)).toBeInTheDocument();
  });

  it("keeps the scoreboard selection in step with the radar", async () => {
    const { container } = await loadDemo();
    const ct = container.querySelector(".sb-team") as HTMLElement;

    await userEvent.click(within(ct).getByText("Alice"));
    expect(await screen.findByRole("heading", { name: "Alice" })).toBeInTheDocument();
  });
});
