/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { newPlaybook } from "@/lib/playbook/pages";
import { PlaybookTree } from "./PlaybookTree";

function treeProps(overrides: Partial<Parameters<typeof PlaybookTree>[0]> = {}) {
  const mirage = newPlaybook("de_mirage", "Defaults");
  mirage.pages[0]!.title = "Mid control";
  return {
    mapNames: ["de_mirage", "de_inferno"],
    books: [mirage],
    mapName: "de_mirage",
    activeKey: mirage.key,
    activePageId: mirage.activePageId,
    expandedBooks: new Set([mirage.key]),
    collapsedMaps: new Set<string>(),
    onSelectMap: vi.fn(),
    onToggleMap: vi.fn(),
    onOpenBook: vi.fn(),
    onToggleBook: vi.fn(),
    onSelectStrat: vi.fn(),
    onCommitBookTitle: vi.fn(),
    onCommitStratTitle: vi.fn(),
    onMoveBook: vi.fn(),
    onMoveStrat: vi.fn(),
    ...overrides,
  };
}

describe("PlaybookTree", () => {
  it("shows maps, playbooks, and expanded strats for the open book", () => {
    const props = treeProps();
    const mirage = props.books[0]!;
    render(<PlaybookTree {...props} />);
    expect(screen.getByRole("button", { name: "Mirage" })).toHaveClass("is-active");
    expect(screen.getByRole("button", { name: "Defaults" })).toHaveClass("is-active");
    expect(screen.getByRole("button", { name: "Mid control" })).toHaveClass("is-active");
    expect(screen.getByText("No playbooks")).toBeInTheDocument();
    expect(document.body.textContent).toContain("└── ");
    fireEvent.click(screen.getByRole("button", { name: "Inferno" }));
    expect(props.onSelectMap).toHaveBeenCalledWith("de_inferno");
    fireEvent.click(screen.getByRole("button", { name: "Defaults" }));
    expect(props.onOpenBook).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Mid control" }));
    expect(props.onSelectStrat).toHaveBeenCalledWith(mirage, mirage.activePageId);
    fireEvent.doubleClick(screen.getByRole("button", { name: "Mirage" }));
    expect(props.onToggleMap).toHaveBeenCalledWith("de_mirage");
    fireEvent.doubleClick(screen.getByRole("button", { name: "Defaults" }));
    expect(props.onToggleBook).toHaveBeenCalledWith(mirage.key);
  });

  it("renames a playbook with F2 and a strat from a double click", () => {
    const props = treeProps();
    const mirage = props.books[0]!;
    render(<PlaybookTree {...props} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Defaults" }), { key: "F2" });
    const bookTitle = screen.getByRole("textbox", { name: "Book title" });
    fireEvent.change(bookTitle, { target: { value: "Anti strats" } });
    fireEvent.blur(bookTitle);
    expect(props.onCommitBookTitle).toHaveBeenCalledWith(mirage, "Anti strats");

    fireEvent.doubleClick(screen.getByRole("button", { name: "Mid control" }));
    const stratName = screen.getByRole("textbox", { name: "Strat name" });
    fireEvent.change(stratName, { target: { value: "A default" } });
    fireEvent.keyDown(stratName, { key: "Enter" });
    expect(props.onCommitStratTitle).toHaveBeenCalledWith(mirage, mirage.activePageId, "A default");
  });

  it("does not auto-expand the active playbook", () => {
    render(
      <PlaybookTree
        {...treeProps({
          expandedBooks: new Set(),
        })}
      />,
    );
    expect(screen.getByRole("button", { name: "Defaults" })).toHaveClass("is-active");
    expect(screen.queryByRole("button", { name: "Mid control" })).not.toBeInTheDocument();
  });

  it("keeps a collapsed map closed until double-clicked", () => {
    const props = treeProps({
      mapNames: ["de_mirage"],
      books: [newPlaybook("de_mirage", "Hidden")],
      mapName: "de_mirage",
      activeKey: null,
      activePageId: null,
      expandedBooks: new Set(),
      collapsedMaps: new Set(["de_mirage"]),
    });
    render(<PlaybookTree {...props} />);
    expect(screen.queryByRole("button", { name: "Hidden" })).not.toBeInTheDocument();
    fireEvent.doubleClick(screen.getByRole("button", { name: "Mirage" }));
    expect(props.onToggleMap).toHaveBeenCalledWith("de_mirage");
  });

  it("moves a playbook and a strat with the arrow buttons", () => {
    const first = newPlaybook("de_mirage", "First", 0);
    const second = newPlaybook("de_mirage", "Second", 1);
    first.pages[0]!.title = "A";
    first.pages.push({ ...first.pages[0]!, id: "p2", title: "B" });
    const props = treeProps({
      books: [first, second],
      activeKey: first.key,
      expandedBooks: new Set([first.key]),
    });
    render(<PlaybookTree {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Move First down" }));
    expect(props.onMoveBook).toHaveBeenCalledWith(first, 1);
    fireEvent.click(screen.getByRole("button", { name: "Move A down" }));
    expect(props.onMoveStrat).toHaveBeenCalledWith(first, first.pages[0]!.id, 1);
  });
});
