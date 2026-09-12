import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FAQ_SLUGS, faqQuestion } from "@/lib/app/faq";
import { ISSUES_URL } from "@/lib/app/links";
import { t } from "@/lib/i18n/messages";
import { en } from "@/lib/i18n/translations/en";
import { pl } from "@/lib/i18n/translations/pl";
import { UserSettingsProvider } from "@/lib/settings/useUserSettings";
import { clearUserSettingsForTests, saveUserSettings } from "@/lib/settings/userSettingsStore";
import { Faq } from "./Faq";

function wrapper({ children }: { children: ReactNode }) {
  return <UserSettingsProvider>{children}</UserSettingsProvider>;
}

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
    for (const slug of FAQ_SLUGS) {
      expect(
        screen.getByRole("heading", { level: 3, name: faqQuestion(en.faq, slug) }),
      ).toBeInTheDocument();
    }
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
    for (const slug of FAQ_SLUGS) {
      expect(
        screen.getByRole("heading", { level: 3, name: faqQuestion(pl.faq, slug) }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { level: 3, name: faqQuestion(en.faq, slug) }),
      ).not.toBeInTheDocument();
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
