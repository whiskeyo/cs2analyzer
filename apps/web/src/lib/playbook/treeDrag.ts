import { parseJson } from "@/lib/validate/json.ts";
import { isRecord, isString } from "@/lib/validate/guards.ts";

export const PLAYBOOK_TREE_DRAG = "application/x-cs2analyzer-playbook-tree";

export type PlaybookTreeDrag =
  | { kind: "book"; mapName: string; key: string }
  | { kind: "strat"; bookKey: string; pageId: string };

export function serializePlaybookTreeDrag(payload: PlaybookTreeDrag): string {
  return JSON.stringify(payload);
}

export function writePlaybookTreeDrag(dt: DataTransfer, payload: PlaybookTreeDrag): void {
  const raw = serializePlaybookTreeDrag(payload);
  dt.setData(PLAYBOOK_TREE_DRAG, raw);
  dt.setData("text/plain", raw);
}

export function readPlaybookTreeDrag(dt: DataTransfer): PlaybookTreeDrag | null {
  return parsePlaybookTreeDrag(dt.getData(PLAYBOOK_TREE_DRAG) || dt.getData("text/plain"));
}

export function parsePlaybookTreeDrag(raw: string): PlaybookTreeDrag | null {
  try {
    const value = parseJson(raw);
    if (!isRecord(value) || !isString(value.kind)) return null;
    if (value.kind === "book" && isString(value.mapName) && isString(value.key)) {
      return { kind: "book", mapName: value.mapName, key: value.key };
    }
    if (value.kind === "strat" && isString(value.bookKey) && isString(value.pageId)) {
      return { kind: "strat", bookKey: value.bookKey, pageId: value.pageId };
    }
    return null;
  } catch {
    return null;
  }
}
