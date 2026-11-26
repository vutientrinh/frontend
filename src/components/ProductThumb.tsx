import { ImageOff } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/utils";

/**
 * Product image (TASK-036 B2): square, 14 px radius (DESIGN.md product-image radius), muted
 * placeholder when the URL is missing or fails to load, dimmed when sold out.
 * `size` is a CSS length for fixed thumbs; omit it to fill the parent (cards).
 */
export function ProductThumb({
  src,
  alt = "",
  size,
  soldOut = false,
  rounded = true,
  className,
}: {
  src?: string | null;
  alt?: string;
  size?: number | string;
  soldOut?: boolean;
  rounded?: boolean;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const broken = !src || failedSrc === src;
  return (
    <span
      data-testid="product-thumb"
      className={cn(
        "relative block aspect-square shrink-0 overflow-hidden bg-muted",
        rounded && "rounded-[14px]",
        className,
      )}
      style={size === undefined ? undefined : { width: size }}
    >
      {broken ? (
        <span className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageOff size={20} aria-hidden="true" />
          {alt && <span className="sr-only">{alt}</span>}
        </span>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src)}
          className={cn("h-full w-full object-cover", soldOut && "opacity-50")}
        />
      )}
    </span>
  );
}
