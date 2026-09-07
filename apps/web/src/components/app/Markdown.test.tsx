import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders GFM links, lists, and emphasis", () => {
    render(
      <Markdown>
        {`Read the [docs](https://example.com/a) and the [Analyzer](/analyzer).\n\n- **bold item**`}
      </Markdown>,
    );
    const docs = screen.getByRole("link", { name: "docs" });
    expect(docs).toHaveAttribute("href", "https://example.com/a");
    expect(docs).toHaveAttribute("target", "_blank");
    const analyzer = screen.getByRole("link", { name: "Analyzer" });
    expect(analyzer).toHaveAttribute("href", "/analyzer");
    expect(analyzer).not.toHaveAttribute("target");
    expect(screen.getByText("bold item")).toBeInTheDocument();
  });

  it("renders inline and display TeX with KaTeX", () => {
    const { container } = render(
      <Markdown>
        {`Inline $E = mc^2$.

$$
a + b
$$`}
      </Markdown>,
    );
    expect(container.querySelectorAll(".katex").length).toBeGreaterThan(0);
    expect(
      container.querySelector(".katex-display, .math-display, .math.math-display"),
    ).toBeInTheDocument();
  });

  it("does not execute HTML from the markdown source", () => {
    const { container } = render(
      <Markdown>
        {`<script>window.__xss=1</script>

**safe**`}
      </Markdown>,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("safe")).toBeInTheDocument();
  });

  it("shifts heading ranks so # nests under a page title", () => {
    render(
      <Markdown headingOffset={2}>
        {`# Question

## Subsection

### Detail`}
      </Markdown>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Question" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Subsection" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 5, name: "Detail" })).toBeInTheDocument();
  });
});
