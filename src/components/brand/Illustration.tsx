import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "../../lib/utils";
import {
  cachedIllustration,
  loadIllustration,
  type IllustrationName,
} from "./illustrations";

const heights = {
  sm: "h-28", // 112 px: inline empty states (panels, side sheets)
  md: "h-40", // 160 px: page empty states
  lg: "h-56", // 224 px: success / error pages
} as const;

/*
 * The SVGs colour themselves from the theme tokens. The three neutrals unDraw uses that have
 * no token of their own are mixed from tokens here, so light and dark both work.
 */
const palette = {
  "--jw-ink": "color-mix(in oklch, var(--foreground) 82%, var(--background))",
  "--jw-soft": "color-mix(in oklch, var(--muted) 40%, var(--border))",
  "--jw-mid": "color-mix(in oklch, var(--border) 55%, var(--input))",
} as CSSProperties;

/**
 * Decorative scene from the illustration kit. Always pair it with a text title: the image is
 * hidden from assistive tech. The box keeps its height while the SVG loads (no layout shift).
 */
export function Illustration({
  name,
  size = "md",
  className,
}: {
  name: IllustrationName;
  size?: keyof typeof heights;
  className?: string;
}) {
  const [loaded, setLoaded] = useState<{ name: string; svg: string } | null>(
    null,
  );
  const svg =
    cachedIllustration(name) ?? (loaded?.name === name ? loaded.svg : "");

  useEffect(() => {
    if (cachedIllustration(name)) return;
    let live = true;
    loadIllustration(name)
      .then((next) => {
        if (live) setLoaded({ name, svg: next });
      })
      .catch(() => {
        // Decorative only: the state's text still explains it.
      });
    return () => {
      live = false;
    };
  }, [name]);

  return (
    <div
      aria-hidden="true"
      data-illustration={name}
      style={palette}
      className={cn(
        "flex w-full justify-center [&>svg]:h-full [&>svg]:w-auto [&>svg]:max-w-full",
        heights[size],
        className,
      )}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
