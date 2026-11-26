import { ExternalLink } from "lucide-react";
import { lazy, Suspense } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/layout/Page";
import { ErrorState, StatusBadge } from "../../components/shared";
import { TableSkeleton } from "../../components/TableSkeleton";
import { Button } from "../../components/ui/button";
import { useSellerProduct } from "../commerce/api";
import type { ProductStatus } from "../commerce/types";

const SellerProductForm = lazy(async () => ({
  default: (await import("./ProductForm")).ProductForm,
}));

const STATUS_NOTE: Record<ProductStatus, string> = {
  DRAFT: "Only you can see this draft. Submit it for review to publish it.",
  PENDING_REVIEW:
    "Waiting for review. It cannot be submitted again until the review ends.",
  LIVE: "Shoppers can see and buy this product.",
  REJECTED: "The review rejected it. Fix the product and submit it again.",
  HIDDEN: "Shoppers cannot see it. Unhide it from the product list.",
};

const loading = (
  <TableSkeleton rows={6} columns={2} label="Loading product form" />
);

export function ProductEditor() {
  const { id } = useParams();
  const q = useSellerProduct(id ?? "");
  const product = id ? q.data : undefined;
  const title = !id ? "New product" : (product?.name ?? "Edit product");
  return (
    <>
      <PageHeader
        title={title}
        description={
          !id
            ? "Save a draft at any time. Review needs at least 3 images."
            : product && STATUS_NOTE[product.status]
        }
        breadcrumb={[
          { label: "Products", to: "/seller/products" },
          { label: !id ? "New product" : (product?.name ?? "Product") },
        ]}
        actions={
          product && (
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={product.status} />
              {product.status === "LIVE" && (
                <Button asChild variant="secondary" className="min-h-11">
                  <Link to={`/p/${product.slug}`}>
                    <ExternalLink size={16} aria-hidden="true" />
                    View on storefront
                  </Link>
                </Button>
              )}
            </div>
          )
        }
      />
      {id && q.isError ? (
        <ErrorState retry={() => void q.refetch()} />
      ) : id && !product ? (
        loading
      ) : (
        <Suspense fallback={loading}>
          <SellerProductForm key={product?.id ?? "new"} product={product} />
        </Suspense>
      )}
    </>
  );
}
