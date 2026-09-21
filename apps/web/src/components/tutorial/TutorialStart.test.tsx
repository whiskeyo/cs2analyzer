import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TestRouter } from "@/lib/testing/router";
import { tutorialHref } from "@/lib/tutorial/query";
import { TutorialStart } from "./TutorialStart";

const warmup = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tutorial/prefetch", () => ({
  warmupTutorialSession: warmup,
}));

describe("TutorialStart", () => {
  beforeEach(() => {
    warmup.mockReset();
  });

  it("is a text link to /tutorial, not a Mirage-sample button", () => {
    render(
      <TestRouter>
        <TutorialStart>If you have questions, see the FAQ.</TutorialStart>
      </TestRouter>,
    );
    const link = screen.getByRole("link", { name: "try the Tutorial first" });
    expect(link).toHaveAttribute("href", tutorialHref("replay"));
    expect(link).toHaveAttribute("href", "/tutorial");
    expect(link).not.toHaveClass("ghost");
    expect(screen.getByText(/Or/)).toBeInTheDocument();
    expect(screen.getByText(/If you have questions, see the FAQ/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Loads a short Mirage sample in the Analyzer/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Mirage sample/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Try without a demo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Don't show again" })).not.toBeInTheDocument();
  });

  it("warms Replay and Aggregated fixtures on pointer down", () => {
    render(
      <TestRouter>
        <TutorialStart />
      </TestRouter>,
    );
    fireEvent.pointerDown(screen.getByRole("link", { name: "try the Tutorial first" }));
    expect(warmup).toHaveBeenCalledOnce();
  });
});
