import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import { NadeLegend } from "./NadeLegend";

describe("NadeLegend", () => {
  it("renders side and kind toggles", () => {
    render(<NadeLegend filter={DEFAULT_SUMMARY_FILTER} onFilter={() => {}} />);
    expect(screen.getByRole("button", { name: "T" })).toHaveClass("on");
    expect(screen.getByRole("button", { name: "Smoke" })).toHaveClass("on");
    expect(screen.getByRole("button", { name: "Molly" })).toHaveClass("on");
    expect(screen.queryByRole("button", { name: "Inc" })).toBeNull();
  });

  it("toggles CT visibility", async () => {
    const onFilter = vi.fn();
    render(<NadeLegend filter={DEFAULT_SUMMARY_FILTER} onFilter={onFilter} />);
    await userEvent.click(screen.getByRole("button", { name: "CT" }));
    expect(onFilter).toHaveBeenCalled();
    const updater = onFilter.mock.calls[0][0] as (
      prev: typeof DEFAULT_SUMMARY_FILTER,
    ) => typeof DEFAULT_SUMMARY_FILTER;
    expect(updater(DEFAULT_SUMMARY_FILTER).ct).toBe(false);
  });

  it("toggles T side and individual nade kinds", async () => {
    const onFilter = vi.fn();
    render(<NadeLegend filter={DEFAULT_SUMMARY_FILTER} onFilter={onFilter} />);

    await userEvent.click(screen.getByRole("button", { name: "T" }));
    const tUpdater = onFilter.mock.calls[0][0] as (
      prev: typeof DEFAULT_SUMMARY_FILTER,
    ) => typeof DEFAULT_SUMMARY_FILTER;
    expect(tUpdater(DEFAULT_SUMMARY_FILTER).t).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Molly" }));
    const kindUpdater = onFilter.mock.calls[1][0] as (
      prev: typeof DEFAULT_SUMMARY_FILTER,
    ) => typeof DEFAULT_SUMMARY_FILTER;
    const next = kindUpdater(DEFAULT_SUMMARY_FILTER);
    expect(next.kinds.molotov).toBe(false);
    expect(next.kinds.incendiary).toBe(false);
  });
});
