import { useState } from "react";
import { ShoppingCart, Truck } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ApiError } from "../../banking/client";
import { ErrorState } from "../../../components/shared";
import {
  useAddCartItem,
  useCatalogProducts,
  useProduct,
} from "../../commerce/api";
import type { ProductDetail } from "../../commerce/types";
import { DealsCarousel } from "../components/DealsCarousel";
import { ImageGallery } from "../components/ImageGallery";
import { PriceTag } from "../components/PriceTag";
import { ProductReviews } from "../components/ProductReviews";
import { QuantityStepper } from "../components/QuantityStepper";
import { RatingStars } from "../components/RatingStars";
import { SellerCard } from "../components/SellerCard";
import { VariantPicker } from "../components/VariantPicker";
import { addedToCartToast, errorMessage, useSignInRedirect } from "../hooks";
import { findVariant, formatCount, type VariantSelection } from "../lib";
import { type } from "../type";
import { Amount } from "../components/Amount";

/** W-13 Product detail. */
export default function ProductPage() {
  const { slug = "" } = useParams();
  const product = useProduct(slug);
  if (product.isError) {
    if (product.error instanceof ApiError && product.error.status === 404)
      return (
        <div className="py-10">
          <h1 className={type.h1}>Product not found</h1>
          <p className="mt-2 text-muted-foreground">
            It may have been removed or hidden by the seller.
          </p>
          <Link to="/" className="mt-4 inline-block text-primary">
            Back to the store
          </Link>
        </div>
      );
    return (
      <ErrorState
        message="Could not load this product."
        retry={() => void product.refetch()}
      />
    );
  }
  if (product.isLoading || !product.data)
    return (
      <div
        role="status"
        aria-busy="true"
        className="grid gap-8 lg:grid-cols-12"
      >
        <span className="sr-only">Loading product</span>
        <div className="mx-auto aspect-square w-full max-w-[560px] rounded-lg bg-muted motion-safe:animate-pulse lg:col-span-7 lg:max-w-none" />
        <div className="space-y-3 lg:col-span-5" aria-hidden="true">
          <div className="h-7 w-3/4 rounded bg-muted motion-safe:animate-pulse" />
          <div className="h-5 w-1/3 rounded bg-muted motion-safe:animate-pulse" />
          <div className="h-9 w-1/2 rounded bg-muted motion-safe:animate-pulse" />
        </div>
      </div>
    );
  return <ProductView key={product.data.id} product={product.data} />;
}

function initialSelection(product: ProductDetail): VariantSelection {
  const first =
    product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  return first ? { ...first.options } : {};
}

function ProductView({ product }: { product: ProductDetail }) {
  const navigate = useNavigate();
  const add = useAddCartItem();
  const { requireSignIn } = useSignInRedirect();
  const [selection, setSelection] = useState(() => initialSelection(product));
  const [quantity, setQuantity] = useState(1);
  const variant = findVariant(product.variants, product.options, selection);
  const soldOut = !product.variants.some((v) => v.stock > 0);
  const stock = variant?.stock ?? 0;
  const qty = Math.min(quantity, Math.max(stock, 1));
  const canAdd = !!variant && stock > 0 && !add.isPending;

  async function addToCart(thenCheckout: boolean) {
    if (!variant || requireSignIn()) return;
    try {
      await add.mutateAsync({ variantId: variant.id, quantity: qty });
      if (thenCheckout) navigate("/cart");
      else addedToCartToast(`${qty} × ${product.name}`, navigate);
    } catch (error) {
      toast.error(errorMessage(error, "Could not add to cart."));
    }
  }

  return (
    <article className="space-y-8 pb-20 md:pb-0">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/" className="hover:underline">
          Shop
        </Link>{" "}
        /{" "}
        <Link to={`/c/${product.category.slug}`} className="hover:underline">
          {product.category.name}
        </Link>
      </nav>
      <div className="grid gap-8 lg:grid-cols-12 lg:items-start xl:gap-10">
        <div className="mx-auto w-full max-w-[560px] lg:col-span-7 lg:mx-0 lg:max-w-none">
          <ImageGallery
            images={product.images.length ? product.images : [product.imageUrl]}
            alt={product.name}
          />
        </div>
        <div className="min-w-0 space-y-5 lg:sticky lg:top-4 lg:col-span-5">
          <div>
            <h1 className={type.h2}>{product.name}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <a
                href="#reviews"
                className="inline-flex min-h-11 items-center hover:underline"
              >
                <RatingStars
                  rating={product.rating}
                  count={product.ratingCount}
                />
              </a>
              <span>{formatCount(product.soldCount)} sold</span>
            </p>
          </div>
          <div className="rounded-lg bg-muted px-4 py-3">
            <PriceTag
              size="lg"
              price={variant?.price ?? product.price}
              compareAtPrice={variant?.compareAtPrice ?? product.compareAtPrice}
            />
          </div>
          {product.options.length > 0 && (
            <VariantPicker
              options={product.options}
              variants={product.variants}
              value={selection}
              onChange={(next) => {
                setSelection(next);
                setQuantity(1);
              }}
            />
          )}
          {soldOut ? (
            <p role="status" className="font-medium text-destructive">
              Sold out. This product is out of stock in every option.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <QuantityStepper
                id="product-qty"
                value={qty}
                max={stock}
                disabled={!variant || stock === 0}
                onChange={setQuantity}
              />
              <span
                className="text-sm text-muted-foreground"
                aria-live="polite"
              >
                {!variant
                  ? "Choose all options"
                  : stock === 0
                    ? "This option is sold out"
                    : stock <= 5
                      ? `Only ${stock} left`
                      : `${stock} available`}
              </span>
            </div>
          )}
          <ShippingLine product={product} />
          <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 flex gap-2 border-t border-border bg-background p-3 md:static md:border-0 md:p-0">
            <button
              type="button"
              disabled={!canAdd}
              onClick={() => void addToCart(false)}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md border border-primary px-4 text-base font-medium text-primary hover:bg-muted disabled:opacity-50"
            >
              <ShoppingCart size={18} aria-hidden="true" />
              {add.isPending ? "Adding…" : "Add to cart"}
            </button>
            <button
              type="button"
              disabled={!canAdd}
              onClick={() => void addToCart(true)}
              className="min-h-12 flex-1 rounded-md bg-primary px-6 text-base font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Buy now
            </button>
          </div>
          <SellerCard seller={product.seller} />
        </div>
      </div>
      <AboutProduct product={product} />
      <ProductReviews
        rating={product.rating}
        ratingCount={product.ratingCount}
        breakdown={product.ratingBreakdown}
        reviews={product.reviews}
      />
      <MoreFromShop product={product} />
    </article>
  );
}

/** S-05 shipping estimate from the product (optional field); generic line otherwise. */
function ShippingLine({ product }: { product: ProductDetail }) {
  const estimate = product.shippingEstimate;
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Truck size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      {estimate ? (
        <span>
          Delivery to{" "}
          <span className="text-foreground">{estimate.destination}</span> in{" "}
          <span className="text-foreground tabular-nums">
            {estimate.minDays === estimate.maxDays
              ? `${estimate.minDays} days`
              : `${estimate.minDays}–${estimate.maxDays} days`}
          </span>
          , shipping from{" "}
          <span className="text-foreground">
            <Amount amount={estimate.fee} />
          </span>
          . Ships from {product.seller.location}.
        </span>
      ) : (
        <span>
          Ships from {product.seller.location}. Shipping options and fees at
          checkout.
        </span>
      )}
    </p>
  );
}

/**
 * Description + Specifications side by side in one card (C4: no dead middle). Specs are the
 * seller's `specs` when present, else the product attributes; with neither, the description
 * takes the full width.
 */
function AboutProduct({ product }: { product: ProductDetail }) {
  const rows = product.specs?.length
    ? product.specs.map((s) => ({ name: s.label, value: s.value }))
    : product.attributes;
  return (
    <div
      className={`grid gap-8 border-t border-border pt-6 ${rows.length ? "lg:grid-cols-2" : ""}`}
    >
      <section aria-labelledby="description-title" className="min-w-0">
        <h2 id="description-title" className={`mb-2 ${type.h3}`}>
          Description
        </h2>
        <p className="max-w-[75ch] whitespace-pre-line text-sm leading-relaxed">
          {product.description}
        </p>
      </section>
      {rows.length > 0 && (
        <section aria-labelledby="specs-title" className="min-w-0">
          <h2 id="specs-title" className={`mb-2 ${type.h3}`}>
            Specifications
          </h2>
          <dl className="divide-y divide-border border-y border-border text-sm">
            {rows.map((a) => (
              <div
                key={a.name}
                className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-4 py-2"
              >
                <dt className="text-muted-foreground">{a.name}</dt>
                <dd>{a.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}

/** S-05 "More from this shop": other live products of the same seller. */
function MoreFromShop({ product }: { product: ProductDetail }) {
  const more = useCatalogProducts({
    sellerSlug: product.seller.slug,
    size: 12,
  });
  const others = (more.data?.content ?? []).filter((p) => p.id !== product.id);
  if (!others.length) return null;
  return (
    <section aria-labelledby="more-title">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id="more-title" className={type.h3}>
          More from {product.seller.name}
        </h2>
        <Link
          to={`/shop/${product.seller.slug}`}
          className="inline-flex min-h-11 items-center text-sm text-primary hover:underline"
        >
          Visit shop
        </Link>
      </div>
      <DealsCarousel
        products={others}
        label={`More from ${product.seller.name}`}
      />
    </section>
  );
}
