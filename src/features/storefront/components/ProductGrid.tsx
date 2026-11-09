import type { ProductSummary } from "../../commerce/types";
import { useQuickAdd } from "../hooks";
import { productGridClass } from "../lib";
import { ProductCard } from "./ProductCard";
import { QuickPickDialog } from "./QuickPickDialog";

/** Grid of ProductCards with quick add-to-cart (and the option picker) wired in. */
export function ProductGrid({
  products,
  label,
  className = productGridClass,
}: {
  products: ProductSummary[];
  label: string;
  className?: string;
}) {
  const { quickAdd, pendingId, picking, closePicker } = useQuickAdd();
  return (
    <>
      <ul className={className} aria-label={label}>
        {products.map((product) => (
          <li key={product.id} className="flex min-w-0">
            <ProductCard
              product={product}
              adding={pendingId === product.id}
              onAddToCart={(p) => void quickAdd(p)}
            />
          </li>
        ))}
      </ul>
      <QuickPickDialog
        product={picking}
        onOpenChange={(open) => !open && closePicker()}
      />
    </>
  );
}
