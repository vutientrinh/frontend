import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ErrorState } from "../../../components/shared";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../../../components/ui/dialog";
import { useCatalogProducts, useCategories } from "../../commerce/api";
import { CategoryStrip } from "../components/CategoryStrip";
import { FacetPanel } from "../components/FacetPanel";
import { Pager } from "../components/Pager";
import { ProductGrid } from "../components/ProductGrid";
import { SearchBar } from "../components/SearchBar";
import { NoResults, ProductGridSkeleton } from "../components/States";
import { activeFacetCount, type Facets } from "../lib";
import { type } from "../type";

const SORTS = [
  { value: "relevance", label: "Relevance" },
  { value: "best_selling", label: "Best selling" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];
const PAGE_SIZE = 24;
const FACET_KEYS = ["minPrice", "maxPrice", "minRating"] as const;

/**
 * W-11 Search (`/search?q=&category=…`) and W-12 Category (`/c/:slug`, same page pre-filtered,
 * with sub-categories). Every filter, the sort and the page live in the URL.
 */
export default function SearchPage() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const categories = useCategories();

  const q = params.get("q") ?? "";
  const sort = params.get("sort") ?? "relevance";
  const page = Math.max(0, Number(params.get("page")) || 0);
  const facets: Facets = {
    category: slug ?? params.get("category") ?? undefined,
    minPrice: params.get("minPrice") ?? undefined,
    maxPrice: params.get("maxPrice") ?? undefined,
    minRating: params.get("minRating") ?? undefined,
  };
  const products = useCatalogProducts({
    q: q || undefined,
    category: facets.category,
    minPrice: facets.minPrice,
    maxPrice: facets.maxPrice,
    minRating: facets.minRating,
    sort,
    page,
    size: PAGE_SIZE,
  });

  const allCategories = categories.data ?? [];
  const current = allCategories.find((c) => c.slug === facets.category);
  const subCategories = current
    ? allCategories.filter((c) => c.parentId === current.id)
    : [];

  function apply(next: Facets, nextSort = sort, nextPage = 0) {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    for (const key of FACET_KEYS) if (next[key]) search.set(key, next[key]!);
    if (nextSort !== "relevance") search.set("sort", nextSort);
    if (nextPage) search.set("page", String(nextPage));
    if (slug) {
      // Category page: changing the category changes the path.
      const target = next.category ? `/c/${next.category}` : "/search";
      if (next.category !== slug) {
        navigate(`${target}${search.size ? `?${search}` : ""}`);
        return;
      }
    } else if (next.category) search.set("category", next.category);
    setParams(search);
  }
  const clear = () => {
    setFiltersOpen(false);
    if (slug) navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
    else setParams(q ? { q } : {});
  };

  const filterCount = activeFacetCount(facets);
  const title = current
    ? current.name
    : q
      ? `Results for “${q}”`
      : "All products";
  const panel = (idPrefix: string) => (
    <FacetPanel
      idPrefix={idPrefix}
      categories={allCategories}
      value={facets}
      onChange={(next) => {
        setFiltersOpen(false);
        apply(next);
      }}
      onClear={clear}
    />
  );

  return (
    <div className="space-y-5">
      <SearchBar key={q} initialQuery={q} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={type.h1}>{title}</h1>
          {products.data && (
            <p
              className="mt-1 text-sm text-muted-foreground"
              aria-live="polite"
            >
              {products.data.totalElements}{" "}
              {products.data.totalElements === 1 ? "product" : "products"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-muted lg:hidden"
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            Filters{filterCount ? ` (${filterCount})` : ""}
          </button>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Sort by</span>
            <select
              value={sort}
              onChange={(e) => apply(facets, e.target.value)}
              className="min-h-11 rounded-md border border-input bg-background px-2 text-base"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      {subCategories.length > 0 && (
        <CategoryStrip categories={subCategories} label="Sub-categories" />
      )}
      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        <aside aria-label="Filters" className="hidden lg:block">
          {panel("facet")}
        </aside>
        <section aria-label="Search results" className="min-w-0">
          {products.isError ? (
            <ErrorState
              message="Could not load products."
              retry={() => void products.refetch()}
            />
          ) : products.isLoading || !products.data ? (
            <ProductGridSkeleton />
          ) : products.data.content.length === 0 ? (
            <NoResults query={q} onClear={clear} />
          ) : (
            <>
              <ProductGrid products={products.data.content} label="Products" />
              <Pager
                page={products.data.page}
                totalPages={products.data.totalPages}
                onPage={(p) => apply(facets, sort, p)}
              />
            </>
          )}
        </section>
      </div>
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent>
          <DialogTitle className="sr-only">Filters</DialogTitle>
          {panel("facet-sheet")}
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border text-sm hover:bg-muted"
          >
            <X size={16} aria-hidden="true" />
            Close filters
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
