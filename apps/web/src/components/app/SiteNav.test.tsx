import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { navigate } from "@/lib/app/devNavigate";
import { TestRouter } from "@/lib/testing/router";
import { en } from "@/lib/i18n";
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
    expect(screen.getByRole("link", { name: en.nav.analyzer })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: en.nav.playbook })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: en.nav.faq })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: en.nav.analyzer })).toHaveAttribute(
      "href",
      "/analyzer",
    );
    expect(screen.getByRole("link", { name: en.nav.playbook })).toHaveAttribute(
      "href",
      "/playbook",
    );
    expect(screen.getByRole("link", { name: en.nav.faq })).toHaveAttribute("href", "/faq");
  });

  it("marks Analyzer as the current page on /analyzer", () => {
    renderNav("/analyzer");
    expect(screen.getByRole("link", { name: en.nav.analyzer })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: en.nav.playbook })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: en.nav.faq })).not.toHaveAttribute("aria-current");
  });

  it("marks FAQ as the current page on /faq", () => {
    renderNav("/faq");
    expect(screen.getByRole("link", { name: en.nav.faq })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: en.nav.playbook })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: en.nav.analyzer })).not.toHaveAttribute("aria-current");
  });

  it("marks Playbook as the current page on /playbook", () => {
    renderNav("/playbook");
    expect(screen.getByRole("link", { name: en.nav.playbook })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: en.nav.analyzer })).not.toHaveAttribute("aria-current");
  });

  it("navigates to FAQ without a full reload", async () => {
    renderNav("/");
    await userEvent.click(screen.getByRole("link", { name: en.nav.faq }));
    expect(screen.getByRole("link", { name: en.nav.faq })).toHaveAttribute("aria-current", "page");
  });

  it("navigates to Playbook without a full reload", async () => {
    renderNav("/");
    await userEvent.click(screen.getByRole("link", { name: en.nav.playbook }));
    expect(screen.getByRole("link", { name: en.nav.playbook })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("navigates to Analyzer without a full reload", async () => {
    renderNav("/");
    await userEvent.click(screen.getByRole("link", { name: en.nav.analyzer }));
    expect(screen.getByRole("link", { name: en.nav.analyzer })).toHaveAttribute(
      "aria-current",
      "page",
    );
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
