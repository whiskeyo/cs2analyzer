import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
import { CS2_DEMO_MAGIC } from "@/lib/parse/demoFile";
import { deleteAllProjects } from "@/lib/notes/projectStore";
import { App } from "./App";

vi.mock("@/lib/radar/maps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/radar/maps")>();
  return {
    ...actual,
    loadCalibrations: vi.fn(async () => ({ de_mirage: UNIT_CALIBRATION })),
  };
});

vi.mock("@/lib/parse/ensureParser", () => ({
  ensureParser: vi.fn(async () => () => ({ terminate() {} })),
  parserFactory: vi.fn(() => null),
  prefetchParser: vi.fn(),
  discardParserWarmup: vi.fn(),
}));

const TIMINGS: ParseTimings = {
  initMs: 1,
  parseMs: 2,
  jsonMs: 3,
  buffersMs: 4,
  totalMs: 10,
};

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
      makeRound({
        number: 1,
        winner: "CT",
        start_tick: 200,
        freeze_end_tick: 264,
        end_tick: 900,
      }),
    ],
    ticks: makeFreezeTicks(4, 2, 264),
    kills: [makeKill(400, 0, 2)],
  });
}

async function loadDemo() {
  const workers: FakeWorker[] = [];
  const createWorker = () => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker as unknown as Worker;
  };
  const { container } = render(<App createWorker={createWorker} />);

  const input = container.querySelector(".drop input[type=file]") as HTMLInputElement;
  await userEvent.upload(input, new File([`${CS2_DEMO_MAGIC}body`], "match.dem"));

  await waitFor(() => expect(workers[0]).toBeDefined());
  const worker = workers[0];
  await worker.posted;
  worker.emit({ type: "done", replay: fixtureReplay(), timings: TIMINGS });
  await waitFor(() => expect(container.querySelector(".hud-meta")?.textContent).toContain("R1"));
}

describe("App notes restore", () => {
  beforeEach(async () => {
    window.history.replaceState({}, "", "/");
    await deleteAllProjects();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await deleteAllProjects();
  });

  it("shows saved notes after Analyzer → Home → Analyzer without a full reload", async () => {
    await loadDemo();
    expect(window.location.pathname).toBe("/analyzer");
    expect(screen.getByRole("button", { name: "New demo" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(window.location.pathname).toBe("/");
    expect(
      screen.getByRole("heading", { name: /Watch Counter-Strike 2 demos/ }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "Analyzer" }));
    expect(window.location.pathname).toBe("/analyzer");
    expect(await screen.findByRole("heading", { name: "Saved notes" })).toBeInTheDocument();
    expect(screen.getByText("match.dem")).toBeInTheDocument();
    expect(screen.getByText(/Notes auto-save/)).toBeInTheDocument();
  });
});
