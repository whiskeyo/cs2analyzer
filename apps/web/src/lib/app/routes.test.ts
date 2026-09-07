import { describe, expect, it } from "vitest";
import {
  isAnalyzerPath,
  isFaqPath,
  isHomePath,
  isLayoutsPath,
  isPlaybookPath,
  normalizePath,
  ROUTES,
} from "./routes";

describe("normalizePath", () => {
  it("strips a trailing slash except on the root", () => {
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("/faq/")).toBe("/faq");
    expect(normalizePath("/analyzer/")).toBe("/analyzer");
    expect(normalizePath("")).toBe("/");
  });
});

describe("route helpers", () => {
  it("recognizes home, Analyzer, Playbook, FAQ, and layouts paths", () => {
    expect(isHomePath("/")).toBe(true);
    expect(isHomePath("/analyzer")).toBe(false);
    expect(isAnalyzerPath("/analyzer")).toBe(true);
    expect(isAnalyzerPath("/")).toBe(false);
    expect(isPlaybookPath("/playbook")).toBe(true);
    expect(isPlaybookPath("/playbook/")).toBe(true);
    expect(isPlaybookPath("/")).toBe(false);
    expect(isFaqPath("/faq")).toBe(true);
    expect(isFaqPath("/faq/")).toBe(true);
    expect(isFaqPath("/")).toBe(false);
    expect(isLayoutsPath("/layouts")).toBe(true);
    expect(isLayoutsPath("/")).toBe(false);
  });

  it("keeps Analyzer off the site root", () => {
    expect(ROUTES.home).toBe("/");
    expect(ROUTES.analyzer).toBe("/analyzer");
    expect(ROUTES.playbook).toBe("/playbook");
    expect(ROUTES.faq).toBe("/faq");
  });
});
