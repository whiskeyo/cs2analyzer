/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { AppStateProvider, useOptionalAnalyzer, usePlayback, useSession } from "./appState";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <AppStateProvider createWorker={() => ({ terminate() {} }) as unknown as Worker}>
      {children}
    </AppStateProvider>
  );
}

describe("AppStateProvider", () => {
  it("keeps playback unmounted until a demo is parsing or loaded", () => {
    const { result } = renderHook(
      () => ({ session: useSession(), analyzer: useOptionalAnalyzer() }),
      { wrapper },
    );
    expect(result.current.session.session.replay).toBeNull();
    expect(result.current.session.session.parsing).toBe(false);
    expect(result.current.analyzer).toBeNull();
  });

  it("throws usePlayback without AnalyzerRuntime", () => {
    expect(() => {
      renderHook(() => usePlayback(), { wrapper });
    }).toThrow(/useAnalyzer/);
  });
});
