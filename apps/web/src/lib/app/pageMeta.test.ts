import { describe, expect, it } from "vitest";
import { pageMeta, pageTitle, SITE_NAME } from "./pageMeta";

describe("pageMeta", () => {
  it("uses distinct titles and descriptions per known route", () => {
    expect(pageTitle("/")).toBe(SITE_NAME);
    expect(pageTitle("/analyzer")).toBe("CS2 Analyzer — Analyzer");
    expect(pageTitle("/playbook")).toBe("CS2 Analyzer — Playbook");
    expect(pageTitle("/faq")).toBe("CS2 Analyzer — FAQ");
    expect(pageTitle("/faq/")).toBe("CS2 Analyzer — FAQ");
    expect(pageTitle("/contact")).toBe("CS2 Analyzer — Contact");
    expect(pageMeta("/").description).toMatch(/Local-first CS2 GOTV viewer/);
    expect(pageMeta("/analyzer").description).toMatch(/demo/);
    expect(pageMeta("/playbook").description).toMatch(/playbook/i);
    expect(pageMeta("/faq").description).toMatch(/FAQ|answers/i);
    expect(pageMeta("/contact").description).toMatch(/Email|Steam|GitHub/);
  });

  it("uses the 404 title for unknown paths", () => {
    expect(pageTitle("/this-page-does-not-exist")).toBe("CS2 Analyzer — Page not found");
    expect(pageTitle("/contact")).not.toBe("CS2 Analyzer — Page not found");
    expect(pageMeta("/missing").description).toBe("This page does not exist.");
  });

  it("names the layouts editor in development", () => {
    expect(pageTitle("/layouts")).toBe(
      import.meta.env.DEV ? "CS2 Analyzer — Layouts" : "CS2 Analyzer — Page not found",
    );
  });
});
