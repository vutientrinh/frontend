import { Link, useParams, useSearchParams } from "react-router-dom";
import { ApiError } from "../../banking/client";
import { ErrorState } from "../../../components/shared";
import { useCatalogProducts, useSellerProfile } from "../../commerce/api";
import { Pager } from "../components/Pager";
import { ProductGrid } from "../components/ProductGrid";
import { SellerCard } from "../components/SellerCard";
import { ProductGridSkeleton } from "../components/States";
import { type } from "../type";

/** W-14 Seller shop: profile and the seller's live products (page in URL). */
export default function ShopPage() {
  const { seller: slug = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const page = Math.max(0, Number(params.get("page")) || 0);
  const profile = useSellerProfile(slug);
  const products = useCatalogProducts({ sellerSlug: slug, page, size: 24 });

  if (profile.isError)
    return profile.error instanceof ApiError && profile.error.status === 404 ? (
      <div className="py-10">
        <h1 className={type.h1}>Shop not found</h1>
        <Link to="/" className="mt-4 inline-block text-primary">
          Back to the store
        </Link>
      </div>
    ) : (
      <ErrorState
        message="Could not load this shop."
        retry={() => void profile.refetch()}
      />
    );

  const p = profile.data;
  return (
    <div className="space-y-6">
      {p?.bannerUrl && (
        <img
          src={p.bannerUrl}
          alt=""
          className="aspect-[5/1] w-full rounded-lg bg-muted object-cover"
        />
      )}
      <header>
        <h1 className={type.h1}>{p?.name ?? "Shop"}</h1>
        {p?.description && (
          <p className="mt-1 max-w-[75ch] text-sm text-muted-foreground">
            {p.description}
          </p>
        )}
      </header>
      {p && (
        <SellerCard
          seller={p}
          logoUrl={p.logoUrl || undefined}
          productCount={p.productCount}
          responseRate={p.responseRate}
          showShopLink={false}
        />
      )}
      <section aria-labelledby="shop-products-title">
        <h2 id="shop-products-title" className={`mb-3 ${type.h3}`}>
          Products
        </h2>
        {products.isError ? (
          <ErrorState
            message="Could not load products."
            retry={() => void products.refetch()}
          />
        ) : products.isLoading || !products.data ? (
          <ProductGridSkeleton />
        ) : products.data.content.length === 0 ? (
          <p className="text-muted-foreground">
            This shop has no products on sale right now.
          </p>
        ) : (
          <>
            <ProductGrid
              products={products.data.content}
              label={`Products from ${p?.name ?? "this shop"}`}
            />
            <Pager
              page={products.data.page}
              totalPages={products.data.totalPages}
              onPage={(n) => setParams(n ? { page: String(n) } : {})}
            />
          </>
        )}
      </section>
    </div>
  );
}
