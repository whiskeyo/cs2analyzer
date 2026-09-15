/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PawnLegend } from "./PawnLegend";

describe("PawnLegend", () => {
  it("renders unique colour → name rows", () => {
    render(
      <PawnLegend
        entries={[
          { label: "donk", color: "#ff2d6a" },
          { label: "m0NESY", color: "#00f0ff" },
        ]}
      />,
    );
    const list = screen.getByRole("list", { name: "Player colours" });
    expect(list).toHaveTextContent("donk");
    expect(list).toHaveTextContent("m0NESY");
    expect(list.querySelectorAll(".playbook-legend-swatch")).toHaveLength(2);
  });

  it("renders nothing when the list is empty", () => {
    const { container } = render(<PawnLegend entries={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("list", { name: "Player colours" })).toBeNull();
  });
});
