import { describe, expect, it } from "vitest";
import { DEMO_MAX_BYTES } from "@/lib/shared/constants";
import {
  CS2_DEMO_MAGIC,
  SOURCE1_DEMO_MAGIC,
  demoFileNameIssue,
  formatParseError,
  inspectDemoFile,
  partitionDemoFiles,
  sniffDemoMagic,
} from "./demoFile";

function fileWithSize(name: string, size: number, body = "x"): File {
  const file = new File([body], name);
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function cs2File(name: string, extra = "xxxx"): File {
  return new File([`${CS2_DEMO_MAGIC}${extra}`], name);
}

describe("demoFileNameIssue", () => {
  it("rejects an empty file", () => {
    expect(demoFileNameIssue(new File([], "match.dem"))).toContain("empty");
  });

  it("rejects a file over the named size cap", () => {
    const huge = fileWithSize("big.dem", DEMO_MAX_BYTES + 1);
    expect(demoFileNameIssue(huge)).toContain("too large");
    expect(demoFileNameIssue(huge)).toContain("1 GB");
  });

  it("rejects gzip names and MIME without reading bytes", () => {
    expect(demoFileNameIssue(fileWithSize("match.dem.gz", 12))).toContain(
      "unsupported gzip",
    );
    expect(demoFileNameIssue(fileWithSize("match.gz", 12))).toContain(
      "unsupported gzip",
    );
    expect(
      demoFileNameIssue(
        new File(["xxxx"], "match.dem", { type: "application/gzip" }),
      ),
    ).toContain("unsupported gzip");
  });

  it("rejects a non-.dem extension", () => {
    expect(demoFileNameIssue(fileWithSize("clip.mp4", 40))).toContain(
      "not a .dem file",
    );
    expect(demoFileNameIssue(fileWithSize("notes.txt", 40))).toContain(
      "not a .dem file",
    );
  });

  it("rejects a POV-looking filename", () => {
    expect(demoFileNameIssue(fileWithSize("player_pov.dem", 40))).toContain(
      "POV demo",
    );
    expect(demoFileNameIssue(fileWithSize("POV.dem", 40))).toContain(
      "POV demo",
    );
    expect(demoFileNameIssue(fileWithSize("match.dem", 40))).toBeNull();
    expect(demoFileNameIssue(fileWithSize("improvement.dem", 40))).toBeNull();
  });
});

describe("sniffDemoMagic", () => {
  it("detects gzip, Source 1, and non-CS2 payloads", () => {
    expect(
      sniffDemoMagic(new Uint8Array([0x1f, 0x8b, 0x08]), "a.dem"),
    ).toContain("unsupported gzip");
    expect(
      sniffDemoMagic(new TextEncoder().encode(SOURCE1_DEMO_MAGIC), "old.dem"),
    ).toContain("Source 1");
    expect(
      sniffDemoMagic(new TextEncoder().encode("notademo"), "fake.dem"),
    ).toContain("not a Counter-Strike 2 demo");
    expect(
      sniffDemoMagic(new TextEncoder().encode(CS2_DEMO_MAGIC), "gotv.dem"),
    ).toBeNull();
  });
});

describe("inspectDemoFile", () => {
  it("accepts a CS2 magic stub and rejects a gzip payload named .dem", async () => {
    expect(await inspectDemoFile(cs2File("gotv.dem"))).toBeNull();
    const gzip = new File(
      [new Uint8Array([0x1f, 0x8b, 0x08, 0x00])],
      "gotv.dem",
    );
    expect(await inspectDemoFile(gzip)).toContain("unsupported gzip");
  });
});

describe("partitionDemoFiles", () => {
  it("keeps valid demos and records issues", async () => {
    const good = cs2File("a.dem");
    const empty = new File([], "empty.dem");
    const { ok, issues } = await partitionDemoFiles([
      empty,
      good,
      new File(["nope"], "clip.mp4"),
    ]);
    expect(ok).toEqual([good]);
    expect(issues).toHaveLength(2);
    expect(issues[0]?.message).toContain("empty");
    expect(issues[1]?.message).toContain("not a .dem file");
  });
});

describe("formatParseError", () => {
  it("maps Source 2 / truncated / corrupt parser failures", () => {
    expect(
      formatParseError("Supports only Source 2 replays", "bad.dem"),
    ).toContain("not a Counter-Strike 2 demo");
    expect(formatParseError("unexpected eof in packet", "cut.dem")).toContain(
      "truncated",
    );
    expect(formatParseError("failed to parse demo: junk", "x.dem")).toContain(
      "corrupt",
    );
  });

  it("leaves Wasm fetch and decode errors alone", () => {
    expect(formatParseError("failed to fetch Wasm: 404 Not Found")).toBe(
      "failed to fetch Wasm: 404 Not Found",
    );
    expect(formatParseError("header: expected object")).toBe(
      "header: expected object",
    );
  });
});
