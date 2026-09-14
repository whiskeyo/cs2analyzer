import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CONTACT_CHANNELS } from "@/lib/app/links";
import { TestRouter } from "@/lib/testing/router";
import { Contact } from "./Contact";

describe("Contact", () => {
  it("renders the four contact targets", () => {
    render(
      <TestRouter>
        <Contact />
      </TestRouter>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Contact" })).toBeInTheDocument();
    expect(screen.queryByText(/The analyzer is local-first/)).not.toBeInTheDocument();
    expect(screen.queryByText(/never leaves this machine/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Private notes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Friend request or comment/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Announcements and discussion/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Source, and Issues for bugs/)).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    const cards = screen.getAllByRole("link").filter((el) => el.classList.contains("contact-card"));
    expect(cards).toHaveLength(4);
    expect(cards.map((el) => el.getAttribute("href"))).toEqual(
      CONTACT_CHANNELS.map((channel) => channel.href),
    );
    for (const [index, channel] of CONTACT_CHANNELS.entries()) {
      expect(cards[index]).toHaveTextContent(channel.label);
      expect(cards[index]).toHaveTextContent(channel.detail);
    }
  });
});
