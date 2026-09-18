import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TUTORIAL_SEEN_STORAGE_KEY } from "@/lib/shared/storageKeys";
import { TestRouter } from "@/lib/testing/router";
import { TutorialCoach } from "./TutorialCoach";

describe("TutorialCoach", () => {
  beforeEach(() => {
    localStorage.removeItem(TUTORIAL_SEEN_STORAGE_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(TUTORIAL_SEEN_STORAGE_KEY);
  });

  it("walks short callouts and persists a skip", async () => {
    render(
      <TestRouter path="/analyzer?tutorial=1">
        <TutorialCoach />
      </TestRouter>,
    );
    expect(screen.getByRole("complementary", { name: "Tutorial tips" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No demo required" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Radar" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.queryByRole("complementary", { name: "Tutorial tips" })).not.toBeInTheDocument();
    expect(localStorage.getItem(TUTORIAL_SEEN_STORAGE_KEY)).toBe("1");
  });

  it("stays dismissed after tutorial seen is stored", () => {
    localStorage.setItem(TUTORIAL_SEEN_STORAGE_KEY, "1");
    render(
      <TestRouter path="/analyzer?tutorial=1">
        <TutorialCoach />
      </TestRouter>,
    );
    expect(screen.queryByRole("complementary", { name: "Tutorial tips" })).not.toBeInTheDocument();
  });
});
