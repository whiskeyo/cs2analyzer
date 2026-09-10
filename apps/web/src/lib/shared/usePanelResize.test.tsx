import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { usePanelResize } from "./usePanelResize";

function Harness() {
  const { width, handleProps } = usePanelResize({
    storageKey: "test-panel-width",
    minWidth: 200,
    maxWidth: 400,
    defaultWidth: 300,
    stageSelector: ".stage",
    label: "Resize test panel",
  });
  return (
    <div className="stage" style={{ width: 1200 }}>
      <div {...handleProps} data-width={width} />
    </div>
  );
}

describe("usePanelResize", () => {
  let stage: HTMLDivElement;

  beforeEach(() => {
    localStorage.removeItem("test-panel-width");
    stage = document.createElement("div");
    stage.className = "stage";
    Object.defineProperty(stage, "clientWidth", { value: 1200, configurable: true });
    document.body.appendChild(stage);
  });

  afterEach(() => {
    stage.remove();
  });

  it("exposes separator semantics and snaps to min on double click", () => {
    render(<Harness />);
    const handle = screen.getByRole("separator", { name: "Resize test panel" });
    expect(handle).toHaveAttribute("aria-valuenow", "300");
    handle.setPointerCapture = () => undefined;
    handle.releasePointerCapture = () => undefined;
    handle.hasPointerCapture = () => true;
    fireEvent.doubleClick(handle);
    expect(handle).toHaveAttribute("aria-valuenow", "200");
  });
});
