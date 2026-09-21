import { describe, expect, it, vi } from "vitest";
import {
  emitTutorialCoachAction,
  onTutorialCoachAction,
  tutorialCoachActionFromEvent,
} from "./coachAction";

describe("tutorial coach action DOM", () => {
  it("reads data-tutorial-action from the event target", () => {
    const button = document.createElement("button");
    button.dataset.tutorialAction = "open-notes";
    const inner = document.createElement("span");
    button.append(inner);
    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: inner });
    expect(tutorialCoachActionFromEvent(event)).toBe("open-notes");
  });

  it("dispatches a window event listeners can take", () => {
    const handler = vi.fn();
    const stop = onTutorialCoachAction(handler);
    emitTutorialCoachAction("draw");
    expect(handler).toHaveBeenCalledWith("draw");
    stop();
    emitTutorialCoachAction("draw");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
