import { describe, expect, it } from "vitest";
import { DEMO_TAG_MAX_COUNT, DEMO_TAG_MAX_LENGTH } from "@/lib/shared/constants";
import { normalizeTag, normalizeTags, projectMatchesTag, tagsFromInput } from "./tags";

describe("normalizeTag", () => {
  it("lowercases and strips a leading hash", () => {
    expect(normalizeTag("  #Nuke ")).toBe("nuke");
    expect(normalizeTag("COMEBACK")).toBe("comeback");
  });

  it("hyphenates spaces and underscores", () => {
    expect(normalizeTag("eco round")).toBe("eco-round");
    expect(normalizeTag("force_buy")).toBe("force-buy");
    expect(normalizeTag("a   b")).toBe("a-b");
  });

  it("drops punctuation and empty results", () => {
    expect(normalizeTag("nuke!")).toBe("nuke");
    expect(normalizeTag("---")).toBeNull();
    expect(normalizeTag("   ")).toBeNull();
    expect(normalizeTag("#")).toBeNull();
  });

  it("caps length", () => {
    const tag = normalizeTag("a".repeat(DEMO_TAG_MAX_LENGTH + 8));
    expect(tag).toHaveLength(DEMO_TAG_MAX_LENGTH);
  });
});

describe("normalizeTags", () => {
  it("keeps first-seen order and drops duplicates", () => {
    expect(normalizeTags(["#Nuke", "nuke", "Come Back", "come-back"])).toEqual([
      "nuke",
      "come-back",
    ]);
  });

  it("stops at the demo cap", () => {
    const raw = Array.from({ length: DEMO_TAG_MAX_COUNT + 3 }, (_, i) => `tag${i}`);
    expect(normalizeTags(raw)).toHaveLength(DEMO_TAG_MAX_COUNT);
  });
});

describe("tagsFromInput", () => {
  it("splits hashes and commas, and hyphenates a single phrase", () => {
    expect(tagsFromInput("#nuke #comeback")).toEqual(["nuke", "comeback"]);
    expect(tagsFromInput("nuke, eco round")).toEqual(["nuke", "eco-round"]);
    expect(tagsFromInput("come back")).toEqual(["come-back"]);
  });
});

describe("projectMatchesTag", () => {
  const tags = new Map<string, readonly string[]>([
    ["a", ["nuke", "comeback"]],
    ["b", ["mirage"]],
  ]);

  it("keeps every row when the query is empty", () => {
    expect(projectMatchesTag("a", tags, "  ")).toBe(true);
    expect(projectMatchesTag("missing", tags, "")).toBe(true);
  });

  it("matches a normalized substring", () => {
    expect(projectMatchesTag("a", tags, "Come")).toBe(true);
    expect(projectMatchesTag("b", tags, "nuke")).toBe(false);
    expect(projectMatchesTag("a", tags, "eco round")).toBe(false);
  });
});
