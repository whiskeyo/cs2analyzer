import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CONTACT_CHANNELS,
  CONTACT_EMAIL,
  CONTACT_MAILTO,
  REPO_URL,
  STEAM_GROUP_URL,
  STEAM_PROFILE_URL,
} from "@/lib/app/links";
import { TestRouter } from "@/lib/testing/router";
import { Contact } from "./Contact";

describe("Contact", () => {
  it("renders the four contact targets as icon cards", () => {
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
    expect(screen.queryByText(CONTACT_EMAIL)).not.toBeInTheDocument();
    expect(screen.queryByText(/steamcommunity\.com/)).not.toBeInTheDocument();
    expect(screen.queryByText(/github\.com/)).not.toBeInTheDocument();

    const cards = screen.getAllByRole("link").filter((el) => el.classList.contains("contact-card"));
    expect(cards).toHaveLength(4);
    expect(cards.map((el) => el.getAttribute("href"))).toEqual(
      CONTACT_CHANNELS.map((channel) => channel.href),
    );
    expect(cards.map((el) => el.getAttribute("href"))).toEqual([
      CONTACT_MAILTO,
      STEAM_PROFILE_URL,
      STEAM_GROUP_URL,
      REPO_URL,
    ]);
    for (const [index, channel] of CONTACT_CHANNELS.entries()) {
      const card = cards[index];
      expect(card).toHaveTextContent(channel.label);
      expect(card.querySelector("svg")).toBeTruthy();
      expect(card.querySelectorAll("a")).toHaveLength(0);
      expect(screen.getByRole("heading", { level: 3, name: channel.label })).toBe(
        card.querySelector("h3"),
      );
      if (channel.external) {
        expect(card).toHaveAttribute("target", "_blank");
        expect(card).toHaveAttribute("rel", "noreferrer");
      } else {
        expect(card).not.toHaveAttribute("target");
        expect(card).not.toHaveAttribute("rel");
      }
    }
  });
});
