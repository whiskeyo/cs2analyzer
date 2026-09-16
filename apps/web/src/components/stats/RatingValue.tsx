import { ratingBandClass, ratingRangeFor } from "@/lib/stats/rating";

export function RatingValue({ value }: { value: number }) {
  return (
    <span className={ratingBandClass(value)} title={ratingRangeFor(value).label}>
      {value.toFixed(2)}
    </span>
  );
}
