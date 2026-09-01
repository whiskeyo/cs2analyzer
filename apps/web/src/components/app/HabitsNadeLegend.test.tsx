import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { HabitsNadeFilter } from "@/lib/parse/seriesOverlay";
import { HabitsNadeLegend } from "./HabitsNadeLegend";

const filter: HabitsNadeFilter = { smoke: true, molotov: true, flash: true, he: true };

function baseProps(overrides: Partial<Parameters<typeof HabitsNadeLegend>[0]> = {}) {
  return {
    filter,
    nadesOn: true,
    nadeOpacity: 0.8,
    onKind: vi.fn(),
    onNadesOn: vi.fn(),
    onOpacity: vi.fn(),
    ...overrides,
  };
}

describe("HabitsNadeLegend", () => {
  it("renders util kind toggles", () => {
    render(<HabitsNadeLegend {...baseProps()} />);
    expect(screen.getByRole("toolbar", { name: "Habits util kinds" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Smoke" })).toHaveClass("on");
  });

  it("toggles a nade kind and the master switch", async () => {
    const onKind = vi.fn();
    const onNadesOn = vi.fn();
    render(<HabitsNadeLegend {...baseProps({ onKind, onNadesOn })} />);

    await userEvent.click(screen.getByRole("button", { name: "Flash" }));
    expect(onKind).toHaveBeenCalledWith("flash", false);

    await userEvent.click(screen.getByRole("button", { name: "Hide all util" }));
    expect(onNadesOn).toHaveBeenCalledWith(false);
  });

  it("disables kind buttons and opacity when util is off", () => {
    render(<HabitsNadeLegend {...baseProps({ nadesOn: false })} />);
    expect(screen.getByRole("button", { name: "Smoke" })).toBeDisabled();
    expect(screen.getByLabelText("Util opacity")).toBeDisabled();
  });

  it("updates opacity from the slider", () => {
    const onOpacity = vi.fn();
    render(<HabitsNadeLegend {...baseProps({ onOpacity })} />);
    fireEvent.change(screen.getByLabelText("Util opacity"), { target: { value: "50" } });
    expect(onOpacity).toHaveBeenCalledWith(0.5);
  });
});
