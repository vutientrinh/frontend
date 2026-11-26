import { Pause, Play } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { Link } from "react-router-dom";
import { cn } from "../../../lib/utils";
import type { Campaign } from "../../commerce/types";
import { type } from "../type";
import { campaignTones, type Tone } from "./campaignTones";

/** Plan §6.2: 6 s per slide; `hero` motion token for the cross-fade (120 ms under reduced motion). */
export const HERO_INTERVAL_MS = 6000;

const toneOf = (c: Campaign) =>
  (campaignTones as Record<string, (typeof campaignTones)[Tone]>)[c.tone] ??
  campaignTones.brand;

const isVectorArt = (src: string) =>
  /^data:image\/svg\+xml|\.svg(?:[?#]|$)/i.test(src);

/**
 * Campaign image (decorative). SVG artwork is a one-colour silhouette: it is drawn as a CSS mask
 * filled with the tone's `art` colour, because an SVG inside `<img>` cannot inherit
 * `currentColor` (it would render black on every tone). Photos and other formats stay `<img>`.
 */
function CampaignArt({
  src,
  fill,
  eager,
}: {
  src: string;
  fill: string;
  eager: boolean;
}) {
  const box = "hidden aspect-video w-full rounded-lg sm:block";
  if (isVectorArt(src))
    return (
      <span
        aria-hidden="true"
        data-art="mask"
        className={cn(
          box,
          fill,
          "[mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]",
        )}
        style={{ maskImage: `url(${JSON.stringify(src)})` }}
      />
    );
  return (
    <img
      src={src}
      alt=""
      loading={eager ? "eager" : "lazy"}
      className={cn(box, "object-cover")}
    />
  );
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(reducedMotionQuery);
  mq.addEventListener?.("change", onChange);
  return () => mq.removeEventListener?.("change", onChange);
}
function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia(reducedMotionQuery).matches === true,
    () => false,
  );
}

/** Same footprint as the carousel, so the page does not jump when campaigns arrive. */
export function HeroSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading featured campaigns</span>
      <div className="min-h-[248px] rounded-lg bg-muted motion-safe:animate-pulse sm:min-h-[280px] lg:min-h-[320px]" />
      <div className="mt-3 h-11" />
    </div>
  );
}

/**
 * Home hero carousel (TASK-029 A3, plan §5.3 / §6.2). Auto-advances every 6 s; pauses while
 * hovered or focused, with the pause button, and under reduced motion. Arrow keys / Home / End
 * move between the dots. Follows the WAI-ARIA APG carousel pattern (grouped slides, live region
 * only while not rotating).
 */
export function HeroCarousel({ campaigns }: { campaigns: Campaign[] }) {
  const count = campaigns.length;
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const dots = useRef<(HTMLButtonElement | null)[]>([]);
  const active = count ? index % count : 0;
  const rotating = count > 1 && !paused && !hovered && !focused && !reduced;

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(
      () => setIndex((i) => (i + 1) % count),
      HERO_INTERVAL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [rotating, active, count]);

  if (!count) return null;

  const go = (next: number, focus = false) => {
    const i = (next + count) % count;
    setIndex(i);
    if (focus) dots.current[i]?.focus();
  };
  const onDotKey = (e: KeyboardEvent) => {
    const keys: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: count - 1,
    };
    if (!(e.key in keys)) return;
    e.preventDefault();
    go(keys[e.key], true);
  };
  const onBlur = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null))
      setFocused(false);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured campaigns"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
    >
      <div
        id="hero-slides"
        aria-live={rotating ? "off" : "polite"}
        className="grid overflow-hidden rounded-lg"
      >
        {campaigns.map((c, i) => {
          const tone = toneOf(c);
          const current = i === active;
          return (
            <div
              key={c.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              inert={!current}
              data-tone={c.tone}
              className={cn(
                "col-start-1 row-start-1 grid min-h-[248px] items-center gap-6 rounded-lg p-6 transition-opacity duration-[600ms] ease-[cubic-bezier(.2,0,0,1)] motion-reduce:duration-[120ms] sm:min-h-[280px] sm:grid-cols-[minmax(0,1fr)_minmax(0,42%)] sm:p-8 lg:min-h-[320px] lg:p-12",
                tone.surface,
                current ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <div className="max-w-[36ch] space-y-3">
                <h2 className={type.h1}>{c.title}</h2>
                <p className={cn("text-base", tone.subtitle)}>{c.subtitle}</p>
                <Link
                  to={c.href}
                  className={cn(
                    "mt-2 inline-flex min-h-11 items-center rounded-md px-5 text-sm font-semibold focus-visible:outline-offset-4",
                    tone.cta,
                  )}
                >
                  {c.ctaLabel}
                </Link>
              </div>
              <CampaignArt src={c.image} fill={tone.art} eager={i === 0} />
            </div>
          );
        })}
      </div>
      {count > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Play campaigns" : "Pause campaigns"}
            className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            {paused ? (
              <Play size={16} aria-hidden="true" />
            ) : (
              <Pause size={16} aria-hidden="true" />
            )}
          </button>
          <div
            role="group"
            aria-label="Choose a campaign"
            onKeyDown={onDotKey}
            className="flex items-center"
          >
            {campaigns.map((c, i) => (
              <button
                key={c.id}
                ref={(el) => {
                  dots.current[i] = el;
                }}
                type="button"
                aria-controls="hero-slides"
                aria-label={`Campaign ${i + 1} of ${count}: ${c.title}`}
                aria-current={i === active ? "true" : undefined}
                tabIndex={i === active ? 0 : -1}
                onClick={() => go(i)}
                className="group grid h-11 w-8 place-items-center"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-2 rounded-full transition-colors duration-200",
                    i === active
                      ? "w-6 bg-primary"
                      : "w-2 bg-input group-hover:bg-muted-foreground",
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
