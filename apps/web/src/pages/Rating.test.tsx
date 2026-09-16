import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MATCH_RATING_RANGES } from "@/lib/stats/rating";
import { TestRouter } from "@/lib/testing/router";
import { Rating } from "./Rating";

describe("Rating", () => {
  it("renders MathML formulas for the match rating", () => {
    const { container } = render(
      <TestRouter>
        <Rating />
      </TestRouter>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Rating" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "How it is calculated" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Combined score" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Ranges" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 3, name: "Derived rates" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("where").length).toBeGreaterThan(0);
    expect(screen.getByText(/proprietary/)).toBeInTheDocument();
    expect(screen.getByText("Poor")).toBeInTheDocument();
    expect(screen.getByText("Outstanding")).toBeInTheDocument();
    expect(screen.queryByText(/HLTV Rating 2\.0/)).not.toBeInTheDocument();
    const maths = container.querySelectorAll("math");
    expect(maths.length).toBeGreaterThan(5);
    expect(container.querySelector("math[display='block']")).toBeTruthy();
    expect(container.querySelector("mfrac")).toBeTruthy();
    expect(container.querySelector("msub")).toBeTruthy();
    expect(container.textContent).toContain("5.25");
    const graph = container.querySelector("svg[role='img']");
    expect(graph).toBeTruthy();
    expect(graph?.getAttribute("aria-label")).toMatch(/expected rating 5\.25/i);
    expect(container.querySelectorAll(".rating-band")).toHaveLength(MATCH_RATING_RANGES.length * 2);
    expect(container.querySelectorAll(".rating-graph-reading")).toHaveLength(
      MATCH_RATING_RANGES.length,
    );
    expect(screen.getByText(/expected 5\.25/)).toBeInTheDocument();
  });
});
