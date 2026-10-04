import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { App } from "@/components/app/App";
import { normalizePath } from "./routes";
import { renderApp } from "./renderApp";
import { resetTutorialInstallState } from "@/lib/tutorial/useTutorial";

vi.mock("@/lib/tutorial/load", () => ({
  isTutorialSeriesReady: () => false,
  loadTutorialPlaybook: () => Promise.resolve([]),
  loadTutorialReplay: () => new Promise<never>(() => {}),
  loadTutorialSeries: () => new Promise<never>(() => {}),
  peekTutorialSeries: () => null,
  prefetchTutorialSeriesChunks: () => {},
  resetTutorialLoadCache: () => {},
}));

const ROUTES = [
  ["/", "Watch Counter-Strike 2 demos"],
  ["/tutorial", "Start tutorial"],
  ["/tutorial/", "Start tutorial"],
  ["/tutorial/single", "Sample of two rounds from GOTV demo"],
  ["/tutorial/single/", "Sample of two rounds from GOTV demo"],
  ["/tutorial/aggregated", "Sample of multiple GOTV demos"],
  ["/tutorial/aggregated/", "Sample of multiple GOTV demos"],
  ["/analyzer", "Drop a demo"],
  ["/analyzer/", "Drop a demo"],
] as const;

describe("prerendered route hydration", () => {
  let reactRoot: Root | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    if (reactRoot) {
      act(() => {
        reactRoot?.unmount();
      });
      reactRoot = null;
    }
    host?.remove();
    host = null;
    resetTutorialInstallState();
    window.history.replaceState({}, "", "/");
  });

  it.each(ROUTES)("hydrates %s without a recoverable mismatch", async (pathname, copy) => {
    const html = renderToString(renderApp(normalizePath(pathname)));
    expect(html).toContain(copy);

    window.history.replaceState({}, "", pathname);
    const node = document.createElement("div");
    node.innerHTML = html;
    document.body.appendChild(node);
    host = node;
    const errors: string[] = [];
    const consoleErrors: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      consoleErrors.push(args.map(String).join(" "));
      originalError(...args);
    };
    try {
      await act(async () => {
        reactRoot = hydrateRoot(node, <App />, {
          onRecoverableError(error) {
            errors.push(error instanceof Error ? error.message : String(error));
          },
        });
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    } finally {
      console.error = originalError;
    }

    const hydrationLogs = consoleErrors.filter((line) => /hydrat/i.test(line));
    expect(hydrationLogs).toEqual([]);
    expect(errors).toEqual([]);
    expect(node.textContent).toContain(copy);
  });
});
