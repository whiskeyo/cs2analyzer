import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestRouter } from "@/lib/testing/router";
import { tutorialHref } from "@/lib/tutorial/query";
import { TutorialStart } from "./TutorialStart";

describe("TutorialStart", () => {
  it("links Home and Analyzer empty states at ?tutorial=1", () => {
    render(
      <TestRouter>
        <TutorialStart />
      </TestRouter>,
    );
    const link = screen.getByRole("link", { name: "Try without a demo" });
    expect(link).toHaveAttribute("href", tutorialHref("replay"));
    expect(link).toHaveAttribute("href", "/analyzer?tutorial=1");
    expect(screen.getByText(/Mirage sample/)).toBeInTheDocument();
  });
});
