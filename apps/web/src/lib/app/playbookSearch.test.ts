import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import type { Playbook, PlaybookPage } from "@/lib/playbook/types";
import {
  findPlaybook,
  findStrat,
  parsePlaybookQuery,
  playbookHref,
  playbookQueryLabel,
  playbookSearch,
  stratQueryLabel,
} from "./playbookSearch";

function page(id: string, title: string): PlaybookPage {
  return { id, title, body: "", floor: "auto", note: emptyNote() };
}

function book(partial: Partial<Playbook> & Pick<Playbook, "key" | "title">): Playbook {
  return {
    schema: 1,
    mapName: "de_mirage",
    savedAt: 1,
    sort: 0,
    pages: [page("p1", "Default")],
    activePageId: "p1",
    paletteId: "neon",
    color: "#ff2d6a",
    ...partial,
  };
}

describe("playbookSearch", () => {
  it("builds and parses /playbook?map=&playbook=&strat=", () => {
    const search = playbookSearch({
      map: "de_mirage",
      playbook: "my_playbook",
      strat: "my_strat",
    });
    expect(search).toBe("?map=de_mirage&playbook=my_playbook&strat=my_strat");
    expect(parsePlaybookQuery(search)).toEqual({
      map: "de_mirage",
      playbook: "my_playbook",
      strat: "my_strat",
    });
    expect(playbookHref({ map: "de_mirage", playbook: "A execs" })).toBe(
      "/playbook?map=de_mirage&playbook=A+execs",
    );
  });

  it("ignores blank query values", () => {
    expect(parsePlaybookQuery("?map=&playbook=  ")).toEqual({
      map: null,
      playbook: null,
      strat: null,
    });
    expect(playbookSearch({})).toBe("");
  });
});

describe("playbook labels", () => {
  it("uses the title when it is unique on the map, otherwise the key", () => {
    const a = book({ key: "k1", title: "A execs" });
    const b = book({ key: "k2", title: "A execs" });
    expect(playbookQueryLabel([a], a)).toBe("A execs");
    expect(playbookQueryLabel([a, b], a)).toBe("k1");
    expect(findPlaybook([a, b], "de_mirage", "A execs")?.key).toBe("k1");
    expect(findPlaybook([a, b], "de_mirage", "k2")?.key).toBe("k2");
  });

  it("matches a strat by title or id", () => {
    const first = page("s1", "Default");
    const copy = page("s2", "Default");
    const row = book({ key: "k", title: "Book", pages: [first, copy], activePageId: "s1" });
    expect(stratQueryLabel(row.pages, first)).toBe("s1");
    expect(findStrat(row, "s2")?.id).toBe("s2");
    const unique = book({ key: "k", title: "Book", pages: [first], activePageId: "s1" });
    expect(stratQueryLabel(unique.pages, first)).toBe("Default");
    expect(findStrat(unique, "Default")?.id).toBe("s1");
  });
});
