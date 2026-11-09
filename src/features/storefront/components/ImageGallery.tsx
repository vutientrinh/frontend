import { useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../../lib/utils";
import { scrollStripClass } from "../lib";

const SWIPE_THRESHOLD = 40;

const arrowButton =
  "absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/90 text-foreground hover:bg-muted disabled:opacity-0";

/** Product images: thumbnails, prev/next buttons, ←/→ keys on the image, swipe on touch. */
export function ImageGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const count = images.length;
  const current = Math.min(index, Math.max(count - 1, 0));

  if (!count)
    return (
      <div className="grid aspect-square place-items-center rounded-lg bg-muted text-sm text-muted-foreground">
        No images
      </div>
    );

  const go = (next: number) => setIndex(Math.min(Math.max(next, 0), count - 1));
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") go(current - 1);
    else if (e.key === "ArrowRight") go(current + 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(count - 1);
    else return;
    e.preventDefault();
  };
  const onTouchStart = (e: TouchEvent) => {
    touchStart.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    const end = e.changedTouches[0]?.clientX;
    touchStart.current = null;
    if (start === null || end === undefined) return;
    if (start - end > SWIPE_THRESHOLD) go(current + 1);
    else if (end - start > SWIPE_THRESHOLD) go(current - 1);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label={`${alt} images`}
      className="min-w-0"
    >
      <div
        tabIndex={0}
        role="group"
        aria-roledescription="slide"
        aria-label={`Image ${current + 1} of ${count}`}
        onKeyDown={onKeyDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative aspect-square touch-pan-y overflow-hidden rounded-lg bg-muted"
      >
        <img
          src={images[current]}
          alt={count > 1 ? `${alt}, image ${current + 1} of ${count}` : alt}
          width={640}
          height={640}
          className="h-full w-full object-cover"
        />
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              disabled={current === 0}
              onClick={() => go(current - 1)}
              className={cn(arrowButton, "left-2")}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Next image"
              disabled={current === count - 1}
              onClick={() => go(current + 1)}
              className={cn(arrowButton, "right-2")}
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
            <span
              aria-live="polite"
              className="absolute bottom-2 right-2 rounded bg-background/90 px-2 py-0.5 text-xs tabular-nums"
            >
              {current + 1} / {count}
            </span>
          </>
        )}
      </div>
      {count > 1 && (
        <ul
          className={`mt-3 flex gap-2 overflow-x-auto p-0.5 ${scrollStripClass}`}
        >
          {images.map((src, i) => (
            <li key={`${src}-${i}`} className="shrink-0">
              <button
                type="button"
                aria-label={`Show image ${i + 1} of ${count}`}
                aria-current={i === current ? "true" : undefined}
                onClick={() => go(i)}
                className={cn(
                  "block h-16 w-16 overflow-hidden rounded-md border-2",
                  i === current ? "border-primary" : "border-transparent",
                )}
              >
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
