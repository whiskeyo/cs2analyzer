/**
 * Build-time GFM → HTML. Do not import this from pages or components — remark
 * would ship in the client bundle. The Vite plugin and tests are the consumers.
 */
import type { Element, Root as HastRoot } from "hast";
import type { Heading, Root as MdastRoot } from "mdast";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { FEATURE_LIST_CLASS } from "./featureList";

function remarkShiftHeadings(offset: number) {
  return (tree: MdastRoot) => {
    if (offset === 0) {
      return;
    }
    visit(tree, "heading", (node: Heading) => {
      const rank = node.depth + offset;
      node.depth = Math.min(6, Math.max(1, rank)) as Heading["depth"];
    });
  };
}

function rehypeExternalLinks() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") {
        return;
      }
      const href = node.properties.href;
      if (typeof href !== "string" || !/^(https?:)?\/\//i.test(href)) {
        return;
      }
      node.properties.target = "_blank";
      node.properties.rel = ["noreferrer"];
    });
  };
}

function classNames(value: Element["properties"]["className"]): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return [];
}

function rehypeFeatureLists() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "ul") {
        return;
      }
      const classes = classNames(node.properties.className);
      if (!classes.includes(FEATURE_LIST_CLASS)) {
        classes.push(FEATURE_LIST_CLASS);
      }
      node.properties.className = classes;
    });
  };
}

/** GFM HTML. Raw HTML in the source is dropped. `$…$` stays ordinary text. */
export function compileMarkdown(source: string, headingOffset = 0): string {
  const file = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkShiftHeadings, headingOffset)
    .use(remarkRehype)
    .use(rehypeExternalLinks)
    .use(rehypeFeatureLists)
    .use(rehypeStringify)
    .processSync(source);
  return String(file);
}
