import { describe, expect, it } from "vitest";
import { parseLayoutText } from "./layoutIo";
import { emptyLayout, formatLayout } from "./layout";

describe("parseLayoutText", () => {
  it("accepts a schema 1 layout and rejects junk", () => {
    const ok = parseLayoutText(formatLayout(emptyLayout("de_mirage")));
    expect(ok).toEqual({ ok: true, layout: emptyLayout("de_mirage") });
    expect(parseLayoutText("{")).toEqual({ ok: false, reason: "json" });
    expect(parseLayoutText('{"schema":2}')).toEqual({ ok: false, reason: "schema" });
  });
});
