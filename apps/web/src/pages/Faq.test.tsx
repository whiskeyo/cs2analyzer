import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FAQ_ITEMS } from "@/lib/app/faq";
import { ISSUES_URL } from "@/lib/app/links";
import { TestRouter } from "@/lib/testing/router";
import { Faq } from "./Faq";

describe("Faq", () => {
  it("renders every listed question and a GitHub issues link", () => {
    render(
      <TestRouter>
        <Faq />
      </TestRouter>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "FAQ" })).toBeInTheDocument();
    for (const item of FAQ_ITEMS) {
      expect(screen.getByRole("heading", { level: 3, name: item.question })).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { level: 4, name: "ADR and trades" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 4, name: "Do not patch generated proto" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub Issues" })).toHaveAttribute("href", ISSUES_URL);
    expect(screen.getByRole("link", { name: "source2-demo" })).toHaveAttribute(
      "href",
      "https://crates.io/crates/source2-demo",
    );
  });
});
