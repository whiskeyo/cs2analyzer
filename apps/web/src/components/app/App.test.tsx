import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CONTACT_CHANNELS, ISSUES_URL } from "@/lib/app/links";
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
import { IDB_QUOTA_MESSAGE } from "@/lib/storage/quota";
import * as projectStore from "@/lib/notes/projectStore";
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
  await userEvent.upload(input, new File([`${CS2_DEMO_MAGIC}body`], "match.dem"));

  await waitFor(() => expect(workers[0]).toBeDefined());
  const worker = workers[0];
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts on the home page with a drop zone and no Analyzer highlight", () => {
    const { container } = render(
      <App createWorker={() => new FakeWorker() as unknown as Worker} />,
    );
    expect(screen.queryByRole("button", { name: "New demo" })).not.toBeInTheDocument();
    expect(screen.getByText(/One Counter-Strike 2/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Watch Counter-Strike 2 demos/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Saved notes")).not.toBeInTheDocument();
    expect(container.querySelector(".app-backdrop")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".app")).toHaveClass("splash");
    expect(container.querySelector(".app")).not.toHaveClass("board");
    expect(screen.getByRole("link", { name: "Analyzer" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Analyzer" })).toHaveAttribute("href", "/analyzer");
    expect(screen.getByRole("button", { name: /Create a playbook/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pick a map" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Start empty board" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "see the FAQ" })).toHaveAttribute("href", "/faq");
    expect(screen.getByRole("link", { name: "Try without a demo" })).toHaveAttribute(
      "href",
      "/analyzer?tutorial=1",
    );
    const contactLinks = screen.getAllByRole("link", { name: "Contact" });
    expect(contactLinks.length).toBeGreaterThan(0);
    for (const link of contactLinks) {
      expect(link).toHaveAttribute("href", "/contact");
    }
    expect(document.title).toBe("CS2 Analyzer");
  });

  async function expectPreferencesOnBody() {
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Preferences" }));
    const dialog = await screen.findByRole("dialog", { name: "Preferences" });
    const backdrop = dialog.closest(".settings-modal");
    expect(backdrop?.parentElement).toBe(document.body);
    expect(screen.getByRole("button", { name: "Reset all settings" })).toBeInTheDocument();
    // Chrome retargets the opening click onto the new backdrop; that must not close.
    fireEvent.click(backdrop!);
    expect(screen.getByRole("dialog", { name: "Preferences" })).toBeInTheDocument();
  }

  it("opens Preferences from the home gear onto document.body", async () => {
    render(<App createWorker={() => new FakeWorker() as unknown as Worker} />);
    await expectPreferencesOnBody();
    expect(screen.getByText(/One Counter-Strike 2/)).toBeInTheDocument();
  });

  it("opens a create-playbook dialog from the home playbook card", async () => {
    render(<App createWorker={() => new FakeWorker() as unknown as Worker} />);
    await userEvent.click(screen.getByRole("button", { name: /Create a playbook/ }));
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
    expect(screen.queryByText("Loading FAQ…")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "FAQ" })).toBeInTheDocument();
    expect(screen.queryByText(/One Counter-Strike 2/)).not.toBeInTheDocument();
  });

  it("opens Contact from the home hint", async () => {
    const { container } = render(
      <App createWorker={() => new FakeWorker() as unknown as Worker} />,
    );
    const hint = container.querySelector(".home-faq-hint") as HTMLElement;
    await userEvent.click(within(hint).getByRole("link", { name: "Contact" }));
    expect(window.location.pathname).toBe("/contact");
    expect(screen.getByRole("heading", { level: 2, name: "Contact" })).toBeInTheDocument();
    expect(document.title).toBe("CS2 Analyzer — Contact");
    expect(screen.queryByText(/One Counter-Strike 2/)).not.toBeInTheDocument();
  });

  it("opens Preferences above the loaded analyzer chrome", async () => {
    await loadDemo();
    await expectPreferencesOnBody();
    expect(screen.getByText(/match\.dem/)).toBeInTheDocument();
  });

  it("opens Preferences from Playbook onto document.body", async () => {
    render(<App createWorker={() => new FakeWorker() as unknown as Worker} />);
    await userEvent.click(screen.getByRole("link", { name: "Playbook" }));
    expect(await screen.findByRole("heading", { name: "Playbooks" })).toBeInTheDocument();
    await expectPreferencesOnBody();
  });

  it("shows the parsed match on the radar, HUD, and scoreboard", async () => {
    const { container } = await loadDemo();

    expect(screen.getByText(/match\.dem/)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/analyzer");
    expect(hudMeta(container)).toBe("Anubis · R1");
    expect(screen.getByText("Astralis")).toBeInTheDocument();
    expect(container.querySelector(".app-backdrop")).toBeTruthy();
    expect(container.querySelector(".app")).toHaveClass("board");
    expect(container.querySelector(".app")).not.toHaveClass("splash");

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
    await userEvent.upload(input, new File([`${CS2_DEMO_MAGIC}body`], "bad.dem"));
    await waitFor(() => expect(workers[0]).toBeDefined());
    await workers[0].posted;
    workers[0].emit({
      type: "error",
      message: "Supports only Source 2 replays",
    });

    expect(
      await screen.findByText(
        '"bad.dem" is not a Counter-Strike 2 demo. Drop a GOTV .dem from FACEIT, Premier, or matchmaking.',
      ),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/analyzer");
    expect(screen.queryByRole("button", { name: "New demo" })).not.toBeInTheDocument();
  });

  it("rejects a non-demo drop before starting the parser", async () => {
    const workers: FakeWorker[] = [];
    const createWorker = () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    };
    render(<App createWorker={createWorker} />);

    const input = document.querySelector(".drop input[type=file]") as HTMLInputElement;
    const junk = new File(["nope"], "highlight.mp4");
    fireEvent.change(input, { target: { files: [junk] } });

    expect(await screen.findByText(/not a \.dem file/)).toBeInTheDocument();
    expect(workers).toHaveLength(0);
    expect(window.location.pathname).toBe("/analyzer");
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
    const { container } = render(
      <App createWorker={() => new FakeWorker() as unknown as Worker} />,
    );
    await userEvent.click(screen.getByRole("link", { name: "FAQ" }));
    expect(screen.queryByText("Loading FAQ…")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "FAQ" })).toBeInTheDocument();
    expect(screen.queryByText(/One Counter-Strike 2/)).not.toBeInTheDocument();
    expect(container.querySelector(".app-backdrop")).toBeTruthy();
    expect(document.title).toBe("CS2 Analyzer — FAQ");

    await userEvent.click(screen.getByRole("link", { name: "Analyzer" }));
    expect(window.location.pathname).toBe("/analyzer");
    expect(screen.getByText(/One Counter-Strike 2/)).toBeInTheDocument();
    expect(screen.getByText(/Notes auto-save/)).toBeInTheDocument();
    expect(container.querySelector(".app-backdrop")).toBeTruthy();
    expect(document.title).toBe("CS2 Analyzer — Analyzer");
  });

  it("shows Rating when opened at /rating", () => {
    window.history.replaceState({}, "", "/rating");
    const { container } = render(
      <App createWorker={() => new FakeWorker() as unknown as Worker} />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Rating" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rating" })).toHaveAttribute("aria-current", "page");
    expect(container.querySelector("math[display='block']")).toBeTruthy();
    expect(document.title).toBe("CS2 Analyzer — Rating");
    expect(container.querySelector(".app-backdrop")).toBeTruthy();
  });

  it("shows FAQ when opened at /faq", () => {
    window.history.replaceState({}, "", "/faq");
    const { container } = render(
      <App createWorker={() => new FakeWorker() as unknown as Worker} />,
    );
    expect(screen.queryByText("Loading FAQ…")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "FAQ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("aria-current", "page");
    expect(container.querySelector(".app-backdrop")).toBeTruthy();
  });

  it("shows Contact when opened at /contact", () => {
    window.history.replaceState({}, "", "/contact");
    const { container } = render(
      <App createWorker={() => new FakeWorker() as unknown as Worker} />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Contact" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact", current: "page" })).toHaveAttribute(
      "href",
      "/contact",
    );
    expect(document.title).toBe("CS2 Analyzer — Contact");
    expect(container.querySelector(".app-backdrop")).toBeTruthy();
    const cards = [...container.querySelectorAll(".contact-card")];
    expect(cards.map((el) => el.getAttribute("href"))).toEqual(
      CONTACT_CHANNELS.map((channel) => channel.href),
    );
  });

  it("renders a 404 page with a GitHub issues report link", async () => {
    window.history.replaceState({}, "", "/this-page-does-not-exist");
    const { container } = render(
      <App createWorker={() => new FakeWorker() as unknown as Worker} />,
    );
    expect(
      screen.getByRole("heading", {
        name: "This page does not exist. Are you sure the link is correct?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "here" })).toHaveAttribute("href", ISSUES_URL);
    expect(screen.getByRole("link", { name: "Go back to CS2 Analyzer" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("navigation", { name: "Site" })).toBeInTheDocument();
    expect(container.querySelector(".app-backdrop")).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: /Watch Counter-Strike 2 demos/ }),
    ).not.toBeInTheDocument();
    expect(document.title).toBe("CS2 Analyzer — Page not found");
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      "content",
      "This page does not exist.",
    );

    await userEvent.click(screen.getByRole("link", { name: "Go back to CS2 Analyzer" }));
    expect(window.location.pathname).toBe("/");
    expect(
      screen.getByRole("heading", { name: /Watch Counter-Strike 2 demos/ }),
    ).toBeInTheDocument();
    expect(document.title).toBe("CS2 Analyzer");
  });

  it("keeps a loaded demo while visiting FAQ", async () => {
    await loadDemo();
    await userEvent.click(screen.getByRole("link", { name: "FAQ" }));
    expect(screen.queryByText("Loading FAQ…")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "FAQ" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New demo" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "Analyzer" }));
    expect(screen.getByRole("button", { name: "New demo" })).toBeInTheDocument();
    expect(screen.getByText(/match\.dem/)).toBeInTheDocument();
  });

  it("opens Playbook from the site nav without a demo", async () => {
    const { container } = render(
      <App createWorker={() => new FakeWorker() as unknown as Worker} />,
    );
    await userEvent.click(screen.getByRole("link", { name: "Playbook" }));
    expect(window.location.pathname).toBe("/playbook");
    expect(document.title).toBe("CS2 Analyzer — Playbook");
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toMatch(
      /playbook/i,
    );
    expect(await screen.findByRole("heading", { name: "Playbooks" })).toBeInTheDocument();
    expect(container.querySelector(".app-backdrop")).toBeTruthy();
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

  it("shows IndexedDB quota copy in the analyzer when notes cannot save", async () => {
    const quota = new Error("full");
    quota.name = "QuotaExceededError";
    vi.spyOn(projectStore, "saveProject").mockRejectedValue(quota);
    await loadDemo();
    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toHaveTextContent(IDB_QUOTA_MESSAGE);
      },
      { timeout: 2000 },
    );
    expect(screen.queryByText("Drop a demo")).not.toBeInTheDocument();
  });
});
