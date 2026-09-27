import type { ReactNode } from "react";
import type { EconomyBuy } from "@/lib/match/economy";

/** Compact buy glyph. Color comes from the CT or T well around it. */
export function SideBuyIcon({ buy }: { buy: EconomyBuy | null }) {
  if (buy == null) return <span className="round-buy-empty" />;
  return (
    <svg className="round-buy-icon" viewBox="0 0 10 10" aria-hidden="true">
      {glyph(buy)}
    </svg>
  );
}

function glyph(buy: EconomyBuy): ReactNode {
  if (buy === "eco") return <path d="M1.4 2.4h7.2L5 8.3z" fill="currentColor" />;
  if (buy === "anti-eco") return <path d="M1.4 7.6h7.2L5 1.7z" fill="currentColor" />;
  if (buy === "force") {
    return <path d="M6.3.7 2.4 5.3h2.5L3.8 9.3 8 4.3H5.4L6.3.7z" fill="currentColor" />;
  }
  if (buy === "full") {
    return <rect x="1.5" y="1.5" width="7" height="7" rx="0.7" fill="currentColor" />;
  }
  return <path d="M.7 3.5h6.2c.7 0 1.2.5 1.2 1.1v.2H5.5v3.3H4.1V5H.7V3.5z" fill="currentColor" />;
}
