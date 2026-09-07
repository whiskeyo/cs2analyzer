import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { navigate } from "@/lib/app/devNavigate";
import { SiteNav } from "./SiteNav";

describe("SiteNav", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("does not mark Analyzer as the current page on the home route", () => {
    window.history.replaceState({}, "", "/");
    render(<SiteNav />);
    expect(screen.getByRole("link", { name: "Analyzer" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "FAQ" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Analyzer" })).toHaveAttribute("href", "/analyzer");
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
  });

  it("marks Analyzer as the current page on /analyzer", () => {
    window.history.replaceState({}, "", "/analyzer");
    render(<SiteNav />);
    expect(screen.getByRole("link", { name: "Analyzer" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "FAQ" })).not.toHaveAttribute("aria-current");
  });

  it("marks FAQ as the current page on /faq", () => {
    window.history.replaceState({}, "", "/faq");
    render(<SiteNav />);
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Analyzer" })).not.toHaveAttribute("aria-current");
  });

  it("navigates to FAQ without a full reload", async () => {
    window.history.replaceState({}, "", "/");
    render(<SiteNav />);
    await userEvent.click(screen.getByRole("link", { name: "FAQ" }));
    expect(window.location.pathname).toBe("/faq");
  });

  it("navigates to Analyzer without a full reload", async () => {
    window.history.replaceState({}, "", "/");
    render(<SiteNav />);
    await userEvent.click(screen.getByRole("link", { name: "Analyzer" }));
    expect(window.location.pathname).toBe("/analyzer");
  });
});

describe("navigate", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("pushes a new path and notifies listeners", () => {
    window.history.replaceState({}, "", "/");
    navigate("/faq");
    expect(window.location.pathname).toBe("/faq");
  });
});
