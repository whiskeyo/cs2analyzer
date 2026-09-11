import { describe, expect, it } from "vitest";
import { compileMarkdown } from "./compile";

describe("compileMarkdown", () => {
  it("emits GFM tables, strikethrough, and autolinks", () => {
    const html = compileMarkdown(
      `~~old~~ and https://example.com/gfm

| Col | Val |
| --- | --- |
| ADR | 80 |`,
    );
    expect(html).toContain("<del>old</del>");
    expect(html).toContain('href="https://example.com/gfm"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Col</th>");
    expect(html).toContain("<td>ADR</td>");
    expect(html).toContain("<td>80</td>");
  });

  it("drops raw HTML instead of passing it through", () => {
    const html = compileMarkdown(`<img src=x onerror=alert(1)>\n\nparagraph`);
    expect(html).not.toContain("<img");
    expect(html).toContain("<p>paragraph</p>");
  });
});
