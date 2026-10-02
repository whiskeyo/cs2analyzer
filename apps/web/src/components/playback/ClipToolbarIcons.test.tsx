import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ClipCancelIcon, ClipFromPlantIcon, ClipRecordIcon } from "./ClipToolbarIcons";

describe("ClipToolbarIcons", () => {
  it("draws a film frame with a play mark", () => {
    const { container } = render(<ClipRecordIcon />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("rect")).toBeInTheDocument();
    expect(container.querySelectorAll("path").length).toBeGreaterThan(0);
  });

  it("badges the plant clip with the bomb icon", () => {
    const { container } = render(<ClipFromPlantIcon />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    const badge = container.querySelector("img");
    expect(badge).toHaveAttribute("src", expect.stringContaining("weapons/c4.svg"));
    expect(badge).toHaveAttribute("alt", "");
  });

  it("draws a cancel cross", () => {
    const { container } = render(<ClipCancelIcon />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("path")).toBeInTheDocument();
  });
});
