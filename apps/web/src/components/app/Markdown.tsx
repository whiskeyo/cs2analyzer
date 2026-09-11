import { createElement, type ReactNode, useMemo } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const HEADING_RANKS = [1, 2, 3, 4, 5, 6] as const;
type HeadingRank = (typeof HEADING_RANKS)[number];

function shiftedRank(level: HeadingRank, offset: number): HeadingRank {
  const rank = level + offset;
  if (rank < 1) return 1;
  if (rank > 6) return 6;
  return rank as HeadingRank;
}

function markdownComponents(headingOffset: number): Components {
  const headings = Object.fromEntries(
    HEADING_RANKS.map((level) => {
      const tag = `h${shiftedRank(level, headingOffset)}`;
      return [
        `h${level}`,
        ({ children }: { children?: ReactNode }) => createElement(tag, null, children),
      ];
    }),
  ) as Components;
  return {
    a({ href, children }) {
      const external = href != null && /^(https?:)?\/\//i.test(href);
      return (
        <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : undefined)}>
          {children}
        </a>
      );
    },
    ...headings,
  };
}

interface Props {
  children: string;
  /** Added to Markdown heading ranks (`#` is 1). FAQ uses 2 so `#` → h3 under the page h2. */
  headingOffset?: number;
}

/** GFM markdown. HTML in the source is not executed. `$…$` is ordinary text until rating docs need math. */
export function Markdown({ children, headingOffset = 0 }: Props) {
  const components = useMemo(() => markdownComponents(headingOffset), [headingOffset]);
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
