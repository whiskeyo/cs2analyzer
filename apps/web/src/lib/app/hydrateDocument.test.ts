import { describe, expect, it } from "vitest";
import { hydrateAction, prerenderRedirectPath, shouldHydratePrerender } from "./hydrateDocument";

describe("shouldHydratePrerender", () => {
  it("matches a prerender path to the same URL with or without a trailing slash", () => {
    expect(shouldHydratePrerender("/", "/")).toBe(true);
    expect(shouldHydratePrerender("/analyzer", "/analyzer")).toBe(true);
    expect(shouldHydratePrerender("/analyzer", "/analyzer/")).toBe(true);
    expect(shouldHydratePrerender("/tutorial/single", "/tutorial/single/")).toBe(true);
    expect(shouldHydratePrerender("/tutorial/aggregated", "/tutorial/aggregated")).toBe(true);
  });

  it("rejects home HTML opened at another route", () => {
    expect(shouldHydratePrerender("/", "/tutorial")).toBe(false);
    expect(shouldHydratePrerender("/", "/tutorial/single")).toBe(false);
    expect(shouldHydratePrerender("/", "/analyzer")).toBe(false);
    expect(shouldHydratePrerender("/", "/tutorial/aggregated/")).toBe(false);
    expect(shouldHydratePrerender(null, "/analyzer")).toBe(false);
    expect(shouldHydratePrerender("", "/")).toBe(false);
  });
});

describe("hydrateAction", () => {
  it("hydrates when the document was rendered for this path", () => {
    expect(hydrateAction("/analyzer", "/analyzer", true)).toBe("hydrate");
    expect(hydrateAction("/analyzer", "/analyzer/", true)).toBe("hydrate");
    expect(hydrateAction("/", "/", true)).toBe("hydrate");
    expect(hydrateAction("/tutorial", "/tutorial/", true)).toBe("hydrate");
    expect(hydrateAction("/tutorial/single", "/tutorial/single", true)).toBe("hydrate");
    expect(hydrateAction("/tutorial/aggregated", "/tutorial/aggregated/", true)).toBe("hydrate");
  });

  it("redirects a no-slash URL whose HTML belongs to another path", () => {
    expect(hydrateAction("/", "/tutorial", true)).toBe("redirect");
    expect(hydrateAction("/", "/tutorial/single", true)).toBe("redirect");
    expect(hydrateAction("/", "/tutorial/aggregated", true)).toBe("redirect");
    expect(hydrateAction("/", "/analyzer", true)).toBe("redirect");
    expect(prerenderRedirectPath("/analyzer")).toBe("/analyzer/");
    expect(prerenderRedirectPath("/tutorial/single")).toBe("/tutorial/single/");
  });

  it("client-renders when a trailing-slash URL still has the wrong document", () => {
    expect(hydrateAction("/", "/analyzer/", true)).toBe("render");
    expect(hydrateAction("/", "/tutorial/", true)).toBe("render");
  });

  it("client-renders an empty root", () => {
    expect(hydrateAction("/", "/", false)).toBe("render");
    expect(hydrateAction("/analyzer", "/analyzer", false)).toBe("render");
  });
});
