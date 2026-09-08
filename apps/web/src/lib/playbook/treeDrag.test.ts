import { describe, expect, it } from "vitest";
import {
  parsePlaybookTreeDrag,
  PLAYBOOK_TREE_DRAG,
  readPlaybookTreeDrag,
  serializePlaybookTreeDrag,
  writePlaybookTreeDrag,
} from "./treeDrag";

describe("playbook tree drag payload", () => {
  it("round-trips a book and a strat", () => {
    const book = { kind: "book" as const, mapName: "de_mirage", key: "k1" };
    expect(parsePlaybookTreeDrag(serializePlaybookTreeDrag(book))).toEqual(book);
    const data: Record<string, string> = {};
    const dt = {
      setData: (type: string, val: string) => {
        data[type] = val;
      },
      getData: (type: string) => data[type] ?? "",
    } as DataTransfer;
    writePlaybookTreeDrag(dt, { kind: "strat", bookKey: "k1", pageId: "p1" });
    expect(data[PLAYBOOK_TREE_DRAG]).toBeTruthy();
    expect(readPlaybookTreeDrag(dt)).toEqual({ kind: "strat", bookKey: "k1", pageId: "p1" });
    expect(parsePlaybookTreeDrag("nope")).toBeNull();
  });
});
