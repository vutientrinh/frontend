import { MapPin, Store } from "lucide-react";
import { Link } from "react-router-dom";
import type { SellerRef } from "../../commerce/types";
import { RatingStars } from "./RatingStars";

/** Seller block for product detail and checkout. Extra stats appear when the screen has them. */
export function SellerCard({
  seller,
  logoUrl,
  productCount,
  responseRate,
  showShopLink = true,
}: {
  seller: SellerRef;
  logoUrl?: string;
  productCount?: number;
  responseRate?: string;
  showShopLink?: boolean;
}) {
  return (
    <section
      aria-label={`Seller ${seller.name}`}
      className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-muted-foreground">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            width={48}
            height={48}
            className="h-full w-full object-cover"
          />
        ) : (
          <Store size={20} aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-semibold">{seller.name}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <RatingStars rating={seller.rating} size={12} />
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} aria-hidden="true" />
            {seller.location}
          </span>
        </p>
        {(productCount !== undefined || responseRate) && (
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {productCount !== undefined && (
              <div className="flex gap-1">
                <dt className="text-muted-foreground">Products</dt>
                <dd className="tabular-nums">{productCount}</dd>
              </div>
            )}
            {responseRate && (
              <div className="flex gap-1">
                <dt className="text-muted-foreground">Response rate</dt>
                <dd className="tabular-nums">{responseRate}%</dd>
              </div>
            )}
          </dl>
        )}
      </div>
      {showShopLink && (
        <Link
          to={`/shop/${seller.slug}`}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium text-primary hover:bg-muted"
        >
          View shop
        </Link>
      )}
    </section>
  );
}
