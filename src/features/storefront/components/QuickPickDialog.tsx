import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../../../components/ui/dialog";
import { useAddCartItem } from "../../commerce/api";
import type { ProductDetail } from "../../commerce/types";
import { addedToCartToast, errorMessage } from "../hooks";
import { findVariant, type VariantSelection } from "../lib";
import { PriceTag } from "./PriceTag";
import { QuantityStepper } from "./QuantityStepper";
import { VariantPicker } from "./VariantPicker";

/**
 * S-03 quick pick: choose options for a multi-variant product without leaving the grid.
 * The form only mounts while open, so every opening starts with a fresh selection.
 */
export function QuickPickDialog({
  product,
  onOpenChange,
}: {
  product?: ProductDetail;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent>
        {product && (
          <QuickPickForm product={product} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function QuickPickForm({
  product,
  onDone,
}: {
  product: ProductDetail;
  onDone: () => void;
}) {
  const add = useAddCartItem();
  const navigate = useNavigate();
  const [selection, setSelection] = useState<VariantSelection>({});
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string>();
  const variant = findVariant(product.variants, product.options, selection);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!variant) {
      const missing = product.options.find((o) => !selection[o.name]);
      setError(`Choose a ${missing?.name.toLowerCase() ?? "option"} first.`);
      return;
    }
    setError(undefined);
    try {
      await add.mutateAsync({ variantId: variant.id, quantity: qty });
      addedToCartToast(product.name, navigate);
      onDone();
    } catch (err) {
      const message = errorMessage(err, "Could not add to cart.");
      setError(message);
      toast.error(message);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
      <div className="flex gap-3">
        <img
          src={product.imageUrl}
          alt=""
          width={72}
          height={72}
          className="h-[72px] w-[72px] shrink-0 rounded-md bg-muted object-cover"
        />
        <div className="min-w-0">
          <DialogTitle className="line-clamp-2 text-base font-semibold">
            {product.name}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Choose options and quantity, then add to cart.
          </DialogDescription>
          <PriceTag
            price={variant?.price ?? product.price}
            compareAtPrice={variant?.compareAtPrice ?? product.compareAtPrice}
            size="sm"
          />
        </div>
      </div>
      <VariantPicker
        options={product.options}
        variants={product.variants}
        value={selection}
        onChange={(next) => {
          setSelection(next);
          setError(undefined);
          setQty(1);
        }}
        idPrefix="quick"
      />
      {variant && (
        <div className="flex items-center gap-3 text-sm">
          <QuantityStepper
            id="quick-qty"
            label="Quantity"
            value={qty}
            max={variant.stock}
            onChange={setQty}
          />
          <span className="text-muted-foreground">
            {variant.stock} in stock
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to={`/p/${product.slug}`}
          onClick={onDone}
          className="inline-flex min-h-11 items-center text-sm text-primary hover:underline"
        >
          See full details
        </Link>
        <button
          type="submit"
          disabled={add.isPending}
          className="min-h-11 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {add.isPending ? "Adding…" : "Add to cart"}
        </button>
      </div>
    </form>
  );
}
