import Big from "big.js";
import { Star, StarHalf } from "lucide-react";
import { cn } from "../../../lib/utils";
import { formatCount } from "../lib";

/** Rating as a string from the API ("4.6"). Stars round to the nearest half. */
export function RatingStars({
  rating,
  count,
  size = 14,
  className,
}: {
  rating: string;
  count?: number;
  size?: number;
  className?: string;
}) {
  const halves = new Big(rating).times(2).round(0).toNumber();
  const full = Math.floor(halves / 2);
  const half = halves % 2 === 1;
  const label = `Rated ${rating} out of 5${count !== undefined ? `, ${count} ${count === 1 ? "rating" : "ratings"}` : ""}`;
  return (
    <span
      role="img"
      aria-label={label}
      className={cn("inline-flex items-center gap-1 text-xs", className)}
    >
      <span className="inline-flex text-status-pending" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => {
          if (i < full) return <Star key={i} size={size} fill="currentColor" />;
          if (i === full && half)
            return (
              <span key={i} className="relative inline-flex">
                <Star size={size} className="text-border" />
                <StarHalf
                  size={size}
                  fill="currentColor"
                  className="absolute inset-0"
                />
              </span>
            );
          return <Star key={i} size={size} className="text-border" />;
        })}
      </span>
      <span aria-hidden="true" className="tabular-nums text-muted-foreground">
        {rating}
        {count !== undefined && ` (${formatCount(count)})`}
      </span>
    </span>
  );
}
