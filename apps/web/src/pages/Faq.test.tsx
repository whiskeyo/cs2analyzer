import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ISSUES_URL } from "@/lib/app/links";
import { en, pl, t } from "@/lib/i18n";
import { UserSettingsProvider } from "@/lib/settings/useUserSettings";
import { clearUserSettingsForTests, saveUserSettings } from "@/lib/settings/userSettingsStore";
import { Faq } from "./Faq";

function wrapper({ children }: { children: ReactNode }) {
  return <UserSettingsProvider>{children}</UserSettingsProvider>;
}

const EN_QUESTIONS = [
  en.faq.whatIs.question,
  en.faq.privacy.question,
  en.faq.whatToDrop.question,
  en.faq.savedNotes.question,
  en.faq.stats.question,
  en.faq.gotvOrPov.question,
  en.faq.browsers.question,
  en.faq.affiliation.question,
  en.faq.preRelease.question,
  en.faq.report.question,
];

const PL_QUESTIONS = [
  pl.faq.whatIs.question,
  pl.faq.privacy.question,
  pl.faq.whatToDrop.question,
  pl.faq.savedNotes.question,
  pl.faq.stats.question,
  pl.faq.gotvOrPov.question,
  pl.faq.browsers.question,
  pl.faq.affiliation.question,
  pl.faq.preRelease.question,
  pl.faq.report.question,
];

describe("Faq", () => {
  beforeEach(async () => {
    await clearUserSettingsForTests();
  });

  afterEach(async () => {
    await clearUserSettingsForTests();
  });

  it("renders every catalog article and a GitHub issues link", () => {
    const { container } = render(<Faq />);
    expect(screen.getByRole("heading", { level: 2, name: en.faq.title })).toBeInTheDocument();
    expect(screen.getByText(en.faq.lead)).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent);
    expect(headings).toEqual(EN_QUESTIONS);
    expect(
      screen.getByRole("heading", { level: 4, name: en.faq.stats.adrHeading }),
    ).toBeInTheDocument();
    expect(screen.getByText(en.faq.stats.adrBody)).toBeInTheDocument();
    expect(screen.getAllByText(".dem")).toHaveLength(2);
    expect(container.querySelectorAll("code")).toHaveLength(2);
    const issues = screen.getByRole("link", { name: en.faq.report.issuesLink });
    expect(issues).toHaveAttribute("href", ISSUES_URL);
    expect(issues.closest("p")).toHaveTextContent(
      t(en.faq.report.body, { issues: en.faq.report.issuesLink }),
    );
    expect(container.querySelector(".katex, math, .md")).toBeNull();
  });

  it("renders Polish article bodies when locale is pl", async () => {
    await saveUserSettings({ locale: "pl" });
    const { container } = render(<Faq />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText(pl.faq.lead)).toBeInTheDocument();
    });
    const headings = screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent);
    expect(headings).toEqual(PL_QUESTIONS);
    for (const question of EN_QUESTIONS) {
      expect(screen.queryByRole("heading", { level: 3, name: question })).not.toBeInTheDocument();
    }
    expect(
      screen.getByRole("heading", { level: 4, name: pl.faq.stats.adrHeading }),
    ).toBeInTheDocument();
    expect(screen.getByText(pl.faq.stats.adrBody)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 4, name: en.faq.stats.adrHeading }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(pl.faq.whatIs.body)).toBeInTheDocument();
    expect(screen.queryByText(en.faq.whatIs.body)).not.toBeInTheDocument();
    expect(container.querySelector(".katex, math, .md")).toBeNull();
  });
});
