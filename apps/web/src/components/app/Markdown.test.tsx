import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { compileMarkdown } from "@/lib/markdown/compile";
import { FEATURE_LIST_CLASS } from "@/lib/markdown/featureList";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders GFM links, lists, and emphasis", () => {
    render(
      <Markdown
        html={compileMarkdown(
          `Read the [docs](https://example.com/a) and the [Analyzer](/analyzer).\n\n- **bold item**`,
        )}
      />,
    );
    const docs = screen.getByRole("link", { name: "docs" });
    expect(docs).toHaveAttribute("href", "https://example.com/a");
    expect(docs).toHaveAttribute("target", "_blank");
    const analyzer = screen.getByRole("link", { name: "Analyzer" });
    expect(analyzer).toHaveAttribute("href", "/analyzer");
    expect(analyzer).not.toHaveAttribute("target");
    expect(screen.getByText("bold item")).toBeInTheDocument();
  });

  it("treats dollar signs as ordinary text", () => {
    const { container } = render(
      <Markdown html={compileMarkdown(`Eco at $2000, not $E = mc^2$.`)} />,
    );
    expect(container.textContent).toContain("Eco at $2000, not $E = mc^2$.");
    expect(container.querySelector(".katex, math")).toBeNull();
  });

  it("does not execute HTML from the markdown source", () => {
    const { container } = render(
      <Markdown
        html={compileMarkdown(`<script>window.__xss=1</script>

**safe**`)}
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("safe")).toBeInTheDocument();
  });

  it("shifts heading ranks so # nests under a page title", () => {
    render(
      <Markdown
        html={compileMarkdown(
          `# Question

## Subsection

### Detail`,
          2,
        )}
      />,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Question" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Subsection" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 5, name: "Detail" })).toBeInTheDocument();
  });

  it("renders nested dash lists with the homepage feature-list class", () => {
    const { container } = render(
      <Markdown html={compileMarkdown(`- parent item\n    - nested item\n\n1. numbered`)} />,
    );
    const lists = container.querySelectorAll(`ul.${FEATURE_LIST_CLASS}`);
    expect(lists).toHaveLength(2);
    expect(lists[1]?.parentElement?.closest("ul")).toBe(lists[0]);
    expect(screen.getByText("parent item")).toBeInTheDocument();
    expect(screen.getByText("nested item")).toBeInTheDocument();
    const ordered = container.querySelector("ol");
    expect(ordered).toBeTruthy();
    expect(ordered?.classList.contains(FEATURE_LIST_CLASS)).toBe(false);
  });
});
