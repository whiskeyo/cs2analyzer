import { formatRating, UNRATED_RATING } from "@/lib/stats/format";
import { ratingBandClass, ratingRangeFor } from "@/lib/stats/rating";

export function RatingValue({ value, rounds }: { value: number; rounds?: number }) {
  if (rounds === 0) {
    return <span className="rating-unrated">{UNRATED_RATING}</span>;
  }
  return (
    <span className={ratingBandClass(value)} title={ratingRangeFor(value).label}>
      {formatRating(value, rounds)}
    </span>
  );
}
