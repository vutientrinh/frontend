import { ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../../../lib/utils";
import { type } from "../../type";
import { Amount } from "../Amount";
import { campaignTones } from "../campaignTones";
import { categoryIcon } from "./categoryIcon";
import {
  useCategoryCampaign,
  useMenuPreview,
  type CategoryNode,
  type MenuCategory,
} from "./data";

type Layout = "panel" | "sheet";

const pulse = "rounded bg-muted motion-safe:animate-pulse";
const linkHover = "rounded-sm hover:text-primary hover:underline";

/**
 * Right side of the Categories menu (BA spec §4.1/4.2): heading + "Shop all", sub-categories, popular products and,
 * on the desktop panel, the category's campaign. Shared by the mega menu (`panel`) and the sheet (`sheet`).
 * Every link closes the menu through `onNavigate`; the sheet navigates with `replace` so Back does not reopen it.
 */
export function CategoryPane({
  category,
  layout,
  headingId,
  routeSlug,
  onNavigate,
}: {
  category: CategoryNode;
  layout: Layout;
  headingId: string;
  routeSlug?: string;
  onNavigate: () => void;
}) {
  const sheet = layout === "sheet";
  const link = (c: MenuCategory) => ({
    to: `/c/${c.slug}`,
    replace: sheet,
    onClick: onNavigate,
    "aria-current": c.slug === routeSlug ? ("page" as const) : undefined,
  });
  return (
    <div key={category.id} className="jw-cat-pane space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={headingId} className={type.h3}>
          {category.name}
        </h2>
        <Link
          {...link(category)}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <span>
            Shop all <span className="sr-only">{category.name}</span>
            {category.productCount !== undefined && (
              <>
                {" "}
                <span className="tabular-nums">({category.productCount})</span>
              </>
            )}
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>

      {category.children.length > 0 &&
        (sheet ? (
          <ul
            aria-label={`${category.name} sub-categories`}
            className="grid grid-cols-2 gap-2"
          >
            {category.children.map((child) => {
              const Icon = categoryIcon(child.iconName);
              return (
                <li key={child.id}>
                  <Link
                    {...link(child)}
                    className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-md border border-border p-2 text-center text-sm hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:font-semibold"
                  >
                    <Icon
                      size={20}
                      aria-hidden="true"
                      className="text-muted-foreground"
                    />
                    <span className="line-clamp-2">{child.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul
            aria-label={`${category.name} sub-categories`}
            className="grid grid-cols-2 gap-x-6 xl:grid-cols-4"
          >
            {category.children.map((child) => (
              <li key={child.id}>
                <Link
                  {...link(child)}
                  className={cn(
                    "flex min-h-11 items-center text-sm aria-[current=page]:font-semibold aria-[current=page]:text-primary",
                    linkHover,
                  )}
                >
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        ))}

      <Popular category={category} layout={layout} onNavigate={onNavigate} />
    </div>
  );
}

/** "Popular in X": secondary, so it hides quietly on error or when empty (§4.5). */
function Popular({
  category,
  layout,
  onNavigate,
}: {
  category: CategoryNode;
  layout: Layout;
  onNavigate: () => void;
}) {
  const products = useMenuPreview(category.slug);
  const items = products.data?.content.slice(0, 4) ?? [];
  const sheet = layout === "sheet";
  if (products.isError || (products.data && !items.length))
    return sheet ? null : (
      <CampaignTile slug={category.slug} onNavigate={onNavigate} />
    );
  const titleId = `popular-${category.id}-${layout}`;
  const loading = products.isLoading || !products.data;
  return (
    <section
      aria-labelledby={titleId}
      aria-busy={loading || undefined}
      className={sheet ? "" : "grid gap-6 xl:grid-cols-[minmax(0,1fr)_14rem]"}
    >
      <div>
        <h3
          id={titleId}
          className="mb-2 text-sm font-semibold text-muted-foreground"
        >
          Popular in {category.name}
        </h3>
        <ul
          className={cn(
            !loading && "jw-cat-stagger",
            sheet
              ? "-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1"
              : "grid grid-cols-2 gap-2",
          )}
        >
          {loading
            ? Array.from({ length: sheet ? 3 : 4 }, (_, i) => (
                <li
                  key={i}
                  aria-hidden="true"
                  className={
                    sheet ? "w-36 shrink-0 space-y-2" : "flex gap-3 p-2"
                  }
                >
                  <div
                    className={cn(
                      pulse,
                      sheet ? "aspect-square w-full" : "h-16 w-16 shrink-0",
                    )}
                  />
                  <div className="flex-1 space-y-2">
                    <div className={`h-4 w-11/12 ${pulse}`} />
                    <div className={`h-4 w-1/2 ${pulse}`} />
                  </div>
                </li>
              ))
            : items.map((p, i) => {
                const deal = !!p.compareAtPrice;
                return (
                  <li
                    key={p.id}
                    style={{ "--i": i } as CSSProperties}
                    className={sheet ? "w-36 shrink-0 snap-start" : ""}
                  >
                    <Link
                      to={`/p/${p.slug}`}
                      replace={sheet}
                      onClick={onNavigate}
                      className={
                        sheet
                          ? "block space-y-1 rounded-md hover:bg-muted"
                          : "flex gap-3 rounded-md p-2 hover:bg-muted"
                      }
                    >
                      <img
                        src={p.imageUrl}
                        alt=""
                        loading="lazy"
                        width={sheet ? 144 : 64}
                        height={sheet ? 144 : 64}
                        className={cn(
                          "rounded-md bg-muted object-cover",
                          sheet ? "aspect-square w-full" : "h-16 w-16 shrink-0",
                        )}
                      />
                      <span className="min-w-0 space-y-1">
                        <span className="line-clamp-2 text-sm">{p.name}</span>
                        <span className="block text-sm font-semibold tabular-nums">
                          <Amount
                            amount={p.price}
                            tone={deal ? "deal" : "default"}
                          />
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
        </ul>
      </div>
      {!sheet && <CampaignTile slug={category.slug} onNavigate={onNavigate} />}
    </section>
  );
}

/** The category's campaign as a small tile in its tone (desktop only; only when one matches). */
function CampaignTile({
  slug,
  onNavigate,
}: {
  slug: string;
  onNavigate: () => void;
}) {
  const campaign = useCategoryCampaign(slug);
  if (!campaign) return null;
  const tone = campaignTones[campaign.tone] ?? campaignTones.brand;
  return (
    <Link
      to={campaign.href}
      onClick={onNavigate}
      className={cn(
        "hidden flex-col justify-between gap-3 self-start rounded-lg p-4 xl:flex",
        tone.surface,
      )}
    >
      <span className="font-semibold">{campaign.title}</span>
      <span
        className={cn(
          "inline-flex min-h-9 w-fit items-center rounded-md px-3 text-sm font-semibold",
          tone.cta,
        )}
      >
        {campaign.ctaLabel}
      </span>
    </Link>
  );
}
