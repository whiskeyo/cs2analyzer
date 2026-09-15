/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playbookHref } from "@/lib/app/playbookSearch";
import { PLAYBOOK_FOCUS_KEY } from "@/lib/playbook/focus";
import { TestRouter } from "@/lib/testing/router";
import { SnapshotToast } from "./SnapshotToast";

const navigate = vi.fn();
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigate };
});

describe("SnapshotToast", () => {
  beforeEach(() => {
    sessionStorage.removeItem(PLAYBOOK_FOCUS_KEY);
    vi.mocked(navigate).mockReset();
  });

  it("says where the snapshot landed and can open the strat", async () => {
    const onDismiss = vi.fn();
    render(
      <TestRouter path="/analyzer">
        <SnapshotToast
          mapName="de_anubis"
          bookTitle="A execs"
          bookKey="book-1"
          stratTitle="R12 1:24"
          onDismiss={onDismiss}
        />
      </TestRouter>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Saved to A execs · R12 1:24");
    await userEvent.click(screen.getByRole("button", { name: "Open strat" }));
    expect(JSON.parse(sessionStorage.getItem(PLAYBOOK_FOCUS_KEY) ?? "null")).toMatchObject({
      mapName: "de_anubis",
      bookKey: "book-1",
    });
    expect(navigate).toHaveBeenCalledWith(
      playbookHref({
        map: "de_anubis",
        playbook: "A execs",
        strat: "R12 1:24",
      }),
    );
    expect(onDismiss).toHaveBeenCalled();
  });

  it("dismisses without navigating", async () => {
    const onDismiss = vi.fn();
    render(
      <TestRouter path="/analyzer">
        <SnapshotToast
          mapName="de_anubis"
          bookTitle="A execs"
          bookKey="book-1"
          stratTitle="R12 1:24"
          onDismiss={onDismiss}
        />
      </TestRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
