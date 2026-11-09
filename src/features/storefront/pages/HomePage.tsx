import { Link } from "react-router-dom";
import { ErrorState } from "../../../components/shared";
import { useCatalogHome } from "../../commerce/api";
import type { CatalogHome } from "../../commerce/types";
import { CategoryStrip } from "../components/CategoryStrip";
import { DealsCarousel } from "../components/DealsCarousel";
import { PriceTag } from "../components/PriceTag";
import { ProductGrid } from "../components/ProductGrid";
import { SearchBar } from "../components/SearchBar";
import { ProductGridSkeleton } from "../components/States";
import { discountPercent } from "../lib";
import { type } from "../type";

const primaryLink =
  "inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90";

/**
 * Hero slot (S-07). Promotional banners when the API has them; otherwise the deepest
 * discount of the day, so the slot always shows a real product and price.
 */
function Hero({ home }: { home: CatalogHome }) {
  const banner = home.banners[0];
  if (banner)
    return (
      <Link
        to={banner.href}
        className="relative block aspect-[21/9] overflow-hidden rounded-lg bg-muted sm:aspect-[32/9]"
      >
        <img
          src={banner.imageUrl}
          alt=""
          className="h-full w-full object-cover"
        />
        <span className="absolute inset-x-0 bottom-0 bg-background/90 p-4">
          <strong className="block text-lg">{banner.title}</strong>
          <span className="text-sm text-muted-foreground">
            {banner.subtitle}
          </span>
        </span>
      </Link>
    );
  const top = home.deals
    .filter((p) => p.inStock)
    .sort(
      (a, b) =>
        (discountPercent(b.price, b.compareAtPrice) ?? 0) -
        (discountPercent(a.price, a.compareAtPrice) ?? 0),
    )[0];
  if (!top) return null;
  return (
    <section
      aria-labelledby="hero-title"
      className="grid items-center gap-4 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-[minmax(0,1fr)_minmax(0,240px)] lg:grid-cols-[minmax(0,1fr)_320px]"
    >
      <div className="order-2 space-y-3 p-4 sm:order-1 sm:p-6">
        <p className="text-sm font-medium text-muted-foreground">
          Today’s top deal from {top.seller.name}
        </p>
        <h2 id="hero-title" className={`line-clamp-2 ${type.h2}`}>
          {top.name}
        </h2>
        <PriceTag
          price={top.price}
          compareAtPrice={top.compareAtPrice}
          size="lg"
        />
        <div className="flex flex-wrap gap-2">
          <Link to={`/p/${top.slug}`} className={primaryLink}>
            View deal
          </Link>
          <a
            href="#deals-title"
            className="inline-flex min-h-11 items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-muted"
          >
            All deals
          </a>
        </div>
      </div>
      <Link
        to={`/p/${top.slug}`}
        tabIndex={-1}
        aria-hidden="true"
        className="order-1 block aspect-[16/9] bg-muted sm:order-2 sm:aspect-square"
      >
        <img src={top.imageUrl} alt="" className="h-full w-full object-cover" />
      </Link>
    </section>
  );
}

/** W-10 Home: search, categories, hero, deals carousel, recommended (no repeats). */
export default function HomePage() {
  const home = useCatalogHome();
  const dealIds = new Set(home.data?.deals.map((p) => p.id));
  const recommended =
    home.data?.recommended.filter((p) => !dealIds.has(p.id)) ?? [];
  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <h1 className={type.h1}>Shop</h1>
        <SearchBar />
      </header>
      {home.isError ? (
        <ErrorState
          message="Could not load the store. Check your connection and try again."
          retry={() => void home.refetch()}
        />
      ) : home.isLoading || !home.data ? (
        <ProductGridSkeleton label="Loading the store" />
      ) : (
        <>
          <CategoryStrip
            categories={home.data.categories.filter((c) => !c.parentId)}
          />
          <Hero home={home.data} />
          {home.data.deals.length > 0 && (
            <section aria-labelledby="deals-title" className="scroll-mt-4">
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h2 id="deals-title" className={type.h3}>
                  Deals
                </h2>
                <Link
                  to="/search?sort=price_asc"
                  className="inline-flex min-h-11 items-center text-sm text-primary hover:underline"
                >
                  See all
                </Link>
              </div>
              <DealsCarousel products={home.data.deals} label="Deals" />
            </section>
          )}
          {recommended.length > 0 && (
            <section aria-labelledby="recommended-title">
              <h2 id="recommended-title" className={`mb-3 ${type.h3}`}>
                Recommended for you
              </h2>
              <ProductGrid
                products={recommended}
                label="Recommended products"
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
