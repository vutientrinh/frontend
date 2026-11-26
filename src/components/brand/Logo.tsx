import { brand } from "../../config/brand";
import { cn } from "../../lib/utils";

/*
 * Jadeway mark (DESIGN.md §8): a bag handle standing on the bag's top edge, which is also the
 * bar of a "J" whose stem ends in a ledger tick. Same geometry as docs/design/brand/logo.svg;
 * inline so it follows the theme tokens (primary square, primary-foreground strokes).
 */
const HANDLE = "M214 204V162a46 46 0 0 1 92 0v42";
const BAR = "M168 208H344";
const J = "M306 208V302L222 386L156 320";

export function BrandMark({
  className,
  title,
  inverted = false,
}: {
  className?: string;
  /** Pass a title only when the mark stands alone as a link/image; omit it next to the wordmark. */
  title?: string;
  /** Light square + teal strokes, for the brand gradient (hero, auth panel). */
  inverted?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={cn("size-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <rect
        width="512"
        height="512"
        rx="113"
        className={inverted ? "fill-primary-foreground" : "fill-primary"}
      />
      <g
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={inverted ? "stroke-primary" : "stroke-primary-foreground"}
      >
        <path d={HANDLE} strokeWidth="34" />
        <path d={BAR} strokeWidth="44" />
        <path d={J} strokeWidth="44" />
      </g>
    </svg>
  );
}

/**
 * Mark + wordmark lockup for headers and auth. The wordmark is live text in the display face
 * (Be Vietnam Pro 700, −0.02em) so it themes and scales with the type.
 */
export function Logo({
  className,
  markClassName,
  showWordmark = true,
  inverted = false,
}: {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  /** On the brand gradient: inverted mark, text in `primary-foreground`. */
  inverted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-lg font-bold tracking-[-0.02em]",
        inverted ? "text-primary-foreground" : "text-foreground",
        className,
      )}
    >
      <BrandMark
        className={markClassName}
        inverted={inverted}
        title={showWordmark ? undefined : brand.name}
      />
      {showWordmark && <span>{brand.name}</span>}
    </span>
  );
}
