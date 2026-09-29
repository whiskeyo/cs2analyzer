import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TestRouter } from "@/lib/testing/router";
import { tutorialHref } from "@/lib/tutorial/query";
import { Tutorial } from "./Tutorial";

const warmup = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tutorial/prefetch", () => ({
  warmupTutorialSession: warmup,
}));

describe("Tutorial intro hub", () => {
  it("explains the tour and starts coach marks on /tutorial/single", () => {
    render(
      <TestRouter path="/tutorial">
        <Tutorial />
      </TestRouter>,
    );
    expect(screen.getByRole("heading", { name: "Tutorial" })).toBeInTheDocument();
    expect(screen.getByText(/Coach marks highlight one Analyzer control/)).toBeInTheDocument();
    expect(screen.getByText(/click Next in the callout/)).toBeInTheDocument();
    expect(screen.getByText(/two-round GOTV sample/)).toBeInTheDocument();
    expect(screen.getByText(/snapshot to the Playbook/)).toBeInTheDocument();
    expect(screen.getByText(/Snapshots land under that session's map/)).toBeInTheDocument();
    const start = screen.getByRole("link", { name: "Start tutorial" });
    expect(start).toHaveAttribute("href", tutorialHref("replay"));
    expect(start).toHaveAttribute("href", "/tutorial/single");
    expect(screen.queryByRole("complementary", { name: "Tutorial coach" })).not.toBeInTheDocument();
    fireEvent.pointerDown(start);
    expect(warmup).toHaveBeenCalledOnce();
  });
});
