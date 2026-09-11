interface Props {
  /** Trusted HTML from `compileMarkdown` / the FAQ Vite plugin. */
  html: string;
}

/** Precompiled GFM HTML. FAQ articles are compiled at build time. */
export function Markdown({ html }: Props) {
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}
