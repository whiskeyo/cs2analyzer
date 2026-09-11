import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FAQ_ITEMS } from "@/lib/app/faq";
import { ISSUES_URL } from "@/lib/app/links";
import { en } from "@/lib/i18n/translations/en";
import { Faq } from "./Faq";

describe("Faq", () => {
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
});
