/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { PLAYBOOKS_CHANGED_EVENT, emitPlaybooksChanged } from "./events";

describe("emitPlaybooksChanged", () => {
  it("dispatches on window", () => {
    const hits: string[] = [];
    const onChanged = () => hits.push("ok");
    window.addEventListener(PLAYBOOKS_CHANGED_EVENT, onChanged);
    emitPlaybooksChanged();
    window.removeEventListener(PLAYBOOKS_CHANGED_EVENT, onChanged);
    expect(hits).toEqual(["ok"]);
  });
});
