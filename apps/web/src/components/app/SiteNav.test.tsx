import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { navigate } from "@/lib/app/devNavigate";
import { TestRouter } from "@/lib/testing/router";
import { SiteNav } from "./SiteNav";

function renderNav(path = "/") {
  return render(
    <TestRouter path={path}>
      <SiteNav />
    </TestRouter>,
  );
}

describe("SiteNav", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("does not mark Analyzer as the current page on the home route", () => {
    renderNav("/");
    expect(screen.getByRole("link", { name: "Analyzer" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Playbook" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "FAQ" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Contact" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Analyzer" })).toHaveAttribute("href", "/analyzer");
    expect(screen.getByRole("link", { name: "Playbook" })).toHaveAttribute("href", "/playbook");
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
  });

  it("marks Analyzer as the current page on /analyzer", () => {
    renderNav("/analyzer");
    expect(screen.getByRole("link", { name: "Analyzer" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Playbook" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "FAQ" })).not.toHaveAttribute("aria-current");
  });

  it("marks FAQ as the current page on /faq", () => {
    renderNav("/faq");
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Contact" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Playbook" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Analyzer" })).not.toHaveAttribute("aria-current");
  });

  it("marks Contact as the current page on /contact", () => {
    renderNav("/contact");
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "FAQ" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Analyzer" })).not.toHaveAttribute("aria-current");
  });

  it("marks Playbook as the current page on /playbook", () => {
    renderNav("/playbook");
    expect(screen.getByRole("link", { name: "Playbook" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Analyzer" })).not.toHaveAttribute("aria-current");
  });

  it("navigates to FAQ without a full reload", async () => {
    renderNav("/");
    await userEvent.click(screen.getByRole("link", { name: "FAQ" }));
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("aria-current", "page");
  });

  it("navigates to Contact without a full reload", async () => {
    renderNav("/");
    await userEvent.click(screen.getByRole("link", { name: "Contact" }));
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("aria-current", "page");
  });

  it("navigates to Playbook without a full reload", async () => {
    renderNav("/");
    await userEvent.click(screen.getByRole("link", { name: "Playbook" }));
    expect(screen.getByRole("link", { name: "Playbook" })).toHaveAttribute("aria-current", "page");
  });

  it("navigates to Analyzer without a full reload", async () => {
    renderNav("/");
    await userEvent.click(screen.getByRole("link", { name: "Analyzer" }));
    expect(screen.getByRole("link", { name: "Analyzer" })).toHaveAttribute("aria-current", "page");
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
