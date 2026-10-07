import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UNRATED_RATING } from "@/lib/stats/format";
import { ratingBandClass, ratingRangeFor } from "@/lib/stats/rating";
import { RatingValue } from "./RatingValue";

describe("RatingValue", () => {
  it("renders an em dash when no competitive round has started", () => {
    render(<RatingValue value={1.77} rounds={0} />);
    const mark = screen.getByText(UNRATED_RATING);
    expect(mark).toHaveClass("rating-unrated");
    expect(mark).not.toHaveAttribute("title");
    expect(screen.queryByText("1.77")).not.toBeInTheDocument();
  });

  it("renders the match rating once a competitive round has started", () => {
    render(<RatingValue value={5.25} rounds={1} />);
    const mark = screen.getByText("5.25");
    expect(mark).toHaveClass(ratingBandClass(5.25));
    expect(mark).toHaveAttribute("title", ratingRangeFor(5.25).label);
    expect(screen.queryByText(UNRATED_RATING)).not.toBeInTheDocument();
  });
});
