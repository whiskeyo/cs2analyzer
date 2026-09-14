import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ISSUES_URL } from "@/lib/app/links";
import { TestRouter } from "@/lib/testing/router";
import { NotFound } from "./NotFound";

describe("NotFound", () => {
  it("explains the missing page and links to GitHub issues", () => {
    render(
      <TestRouter path="/missing">
        <NotFound />
      </TestRouter>,
    );
    expect(
      screen.getByRole("heading", {
        name: "This page does not exist. Are you sure the link is correct?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "here" })).toHaveAttribute("href", ISSUES_URL);
    expect(screen.getByRole("link", { name: "here" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });
});
