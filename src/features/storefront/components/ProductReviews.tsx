import { useState } from "react";
import { BadgeCheck, Star } from "lucide-react";
import type { ProductReview, RatingBreakdown } from "../../commerce/types";
import { formatOrderDate } from "../lib";
import { RatingStars } from "./RatingStars";
import { type } from "../type";

const FIRST_PAGE = 4;

/**
 * S-05 Reviews: average + per-star breakdown (count as text and a bar, so it is not color
 * alone), then the written reviews, newest first, a few at a time.
 */
export function ProductReviews({
  rating,
  ratingCount,
  breakdown,
  reviews,
}: {
  rating: string;
  ratingCount: number;
  breakdown?: RatingBreakdown;
  reviews?: ProductReview[];
}) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...(reviews ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const shown = expanded ? sorted : sorted.slice(0, FIRST_PAGE);
  const total = breakdown
    ? Object.values(breakdown).reduce((sum, n) => sum + n, 0)
    : 0;

  return (
    <section
      aria-labelledby="reviews-title"
      id="reviews"
      className="scroll-mt-4"
    >
      <h2 id="reviews-title" className={`mb-4 ${type.h3}`}>
        Reviews
      </h2>
      {!ratingCount && !sorted.length ? (
        <p className="text-sm text-muted-foreground">
          No reviews yet. Buyers can review after their order is completed.
        </p>
      ) : (
        <div className="grid gap-8 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
          <div className="space-y-3">
            <p className="flex items-baseline gap-2">
              <span className="text-4xl font-semibold tabular-nums">
                {rating}
              </span>
              <span className="text-sm text-muted-foreground">out of 5</span>
            </p>
            <RatingStars rating={rating} count={ratingCount} size={16} />
            {breakdown && total > 0 && (
              <ul aria-label="Rating breakdown" className="space-y-1.5">
                {([5, 4, 3, 2, 1] as const).map((stars) => {
                  const count = breakdown[stars] ?? 0;
                  const percent = Math.round((count * 100) / total);
                  return (
                    <li
                      key={stars}
                      className="grid grid-cols-[2.5rem_minmax(0,1fr)_3rem] items-center gap-2 text-xs"
                    >
                      <span className="inline-flex items-center gap-0.5 tabular-nums">
                        {stars}
                        <Star size={12} aria-hidden="true" />
                        <span className="sr-only">
                          {stars === 1 ? " star" : " stars"}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="h-2 overflow-hidden rounded-full bg-muted"
                      >
                        <span
                          className="block h-full rounded-full bg-status-pending"
                          style={{ width: `${percent}%` }}
                        />
                      </span>
                      <span className="text-right tabular-nums text-muted-foreground">
                        {count}
                        <span className="sr-only">
                          {` ${count === 1 ? "rating" : "ratings"}, ${percent}%`}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            {sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Buyers rated this product but have not written reviews yet.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-border border-y border-border">
                  {shown.map((r) => (
                    <li key={r.id} className="space-y-1 py-4 text-sm">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <RatingStars rating={String(r.rating)} size={12} />
                        <strong className="font-semibold">{r.title}</strong>
                      </div>
                      <p className="max-w-[75ch] leading-relaxed">{r.body}</p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{r.displayName}</span>
                        <time dateTime={r.createdAt}>
                          {formatOrderDate(r.createdAt)}
                        </time>
                        {r.verifiedPurchase && (
                          <span className="inline-flex items-center gap-1 text-success">
                            <BadgeCheck size={14} aria-hidden="true" />
                            Verified purchase
                          </span>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
                {sorted.length > FIRST_PAGE && (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-3 inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
                  >
                    {expanded
                      ? "Show fewer reviews"
                      : `Show all ${sorted.length} reviews`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
