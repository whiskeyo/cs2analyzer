import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FAQ_ITEMS } from "./faq";
import { NOT_FOUND_PRERENDER_PATH, PRERENDER_PATHS } from "./prerender";
import { renderApp } from "./renderApp";

describe("renderApp", () => {
  it("prerenders FAQ markdown as real HTML text", () => {
    const html = renderToString(renderApp("/faq"));
    expect(html).toContain(">FAQ<");
    expect(html).toMatch(/local-first GOTV analyzer and playbook/i);
    expect(html).not.toMatch(/GOTV viewer/i);
    for (const item of FAQ_ITEMS) {
      expect(html).toContain(item.question);
    }
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/analyzer"');
    expect(html).toContain('href="/playbook"');
  });

  it("prerenders marketing shells for Analyzer and Playbook, not an empty root", () => {
    const analyzer = renderToString(renderApp("/analyzer"));
    expect(analyzer).toContain("Drop a demo");
    expect(analyzer).toContain("Parsed entirely in your browser");
    expect(analyzer).not.toMatch(/GOTV viewer/i);

    const playbook = renderToString(renderApp("/playbook"));
    expect(playbook).toContain("Create a playbook");
    expect(playbook).toContain("Playbooks");
    expect(playbook).toContain("Drawings stay on this machine");
  });

  it("renders visible copy for every public prerender path", () => {
    const snippets: Record<string, string> = {
      "/": "Watch Counter-Strike 2 demos",
      "/analyzer": "Drop a demo",
      "/tutorial": "Start tutorial",
      "/tutorial/single": "Drop a demo",
      "/tutorial/aggregated": "Drop a demo",
      "/tutorial/playbook": "Playbooks",
      "/playbook": "Create a playbook",
      "/faq": "What is CS2 Analyzer?",
      "/rating": "How it is calculated",
      "/contact": "Steam profile",
    };
    for (const path of PRERENDER_PATHS) {
      const html = renderToString(renderApp(path));
      expect(html.length).toBeGreaterThan(200);
      const snippet = snippets[path];
      if (snippet) {
        expect(html).toContain(snippet);
      }
      expect(html).not.toMatch(/GOTV viewer/i);
    }
  });

  it("renders NotFound for the 404 prerender path, not the home page", () => {
    const html = renderToString(renderApp(NOT_FOUND_PRERENDER_PATH));
    expect(html).toContain("This page does not exist. Are you sure the link is correct?");
    expect(html).toContain('class="not-found"');
    expect(html).not.toContain("Watch Counter-Strike 2 demos");
  });

  it("keeps the Analyzer shell when the URL has a trailing slash", () => {
    // NavLink `end` compares pathnames exactly, so the slash form is not
    // `is-active`. main.tsx collapses that slash before hydrate.
    const html = renderToString(renderApp("/analyzer/"));
    expect(html).toContain("Drop a demo");
    expect(html).toContain("try the Tutorial first");
    expect(html).not.toContain("This page does not exist");
    expect(html).not.toContain("Watch Counter-Strike 2 demos");
  });
});
