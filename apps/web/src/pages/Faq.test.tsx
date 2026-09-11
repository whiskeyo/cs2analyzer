import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FAQ_ITEMS, faqItemsFor } from "@/lib/app/faq";
import { ISSUES_URL } from "@/lib/app/links";
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

  it("renders every listed question and a GitHub issues link", () => {
    render(<Faq />);
    expect(screen.getByRole("heading", { level: 2, name: en.faq.title })).toBeInTheDocument();
    expect(screen.getByText(en.faq.lead)).toBeInTheDocument();
    for (const item of FAQ_ITEMS) {
      expect(screen.getByRole("heading", { level: 3, name: item.question })).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { level: 4, name: "ADR and trades" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub Issues" })).toHaveAttribute("href", ISSUES_URL);
  });

  it("renders Polish article bodies when locale is pl", async () => {
    await saveUserSettings({ locale: "pl" });
    render(<Faq />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText(pl.faq.lead)).toBeInTheDocument();
    });
    for (const item of faqItemsFor("pl")) {
      expect(screen.getByRole("heading", { level: 3, name: item.question })).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { level: 4, name: "ADR i trade'y" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 4, name: "ADR and trades" }),
    ).not.toBeInTheDocument();
  });
});
