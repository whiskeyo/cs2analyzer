import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FAQ_ITEMS } from "@/lib/app/faq";
import { ISSUES_URL } from "@/lib/app/links";
import { FEATURE_LIST_CLASS } from "@/lib/markdown/featureList";
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
    expect(screen.getByText(/local-first GOTV analyzer and playbook/i)).toBeInTheDocument();
    expect(screen.queryByText(/GOTV viewer/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "home page" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "open Analyzer for saved notes" })).toHaveAttribute(
      "href",
      "/analyzer",
    );
    expect(screen.getByRole("link", { name: "start a Playbook" })).toHaveAttribute(
      "href",
      "/playbook",
    );
    for (const item of FAQ_ITEMS) {
      expect(screen.getByRole("heading", { level: 3, name: item.question })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Rating System" })).toHaveAttribute("href", "/rating");
    expect(screen.getByRole("link", { name: "GitHub Issues" })).toHaveAttribute("href", ISSUES_URL);
  });

  it("renders FAQ dash lists with the homepage feature-list class, including nests", () => {
    const { container } = render(
      <TestRouter>
        <Faq />
      </TestRouter>,
    );
    const lists = container.querySelectorAll(`.faq-item ul.${FEATURE_LIST_CLASS}`);
    expect(lists.length).toBeGreaterThan(1);
    const nested = container.querySelector(
      `.faq-item ul.${FEATURE_LIST_CLASS} ul.${FEATURE_LIST_CLASS}`,
    );
    expect(nested).toBeTruthy();
    expect(screen.getByText(/Single GOTV Demo Analyzer/)).toBeInTheDocument();
    expect(
      screen.getByText(/Review each player's game: won\/lost opening duels/),
    ).toBeInTheDocument();
    expect(container.querySelector(".faq-item ol")).toBeNull();
  });
});
