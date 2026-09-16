import type { ReactNode } from "react";

/** Local MathML tags — `@types/react` 19.1 does not list them on IntrinsicElements. */
type MathEl = {
  children?: ReactNode;
  className?: string;
  display?: "block" | "inline";
  displaystyle?: boolean | "true" | "false";
  mathvariant?: string;
  columnalign?: string;
  key?: string | number;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      math: MathEl;
      mi: MathEl;
      mo: MathEl;
      mn: MathEl;
      mrow: MathEl;
      mfrac: MathEl;
      msub: MathEl;
      mtext: MathEl;
      mstyle: MathEl;
      mspace: MathEl & { width?: string };
      mtable: MathEl;
      mtr: MathEl;
      mtd: MathEl;
    }
  }
}
