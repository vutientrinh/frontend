import {
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, Store } from "lucide-react";
import { Link } from "react-router-dom";
import type { CartItem, Money as MoneyValue } from "../../commerce/types";
import { errorMessage, useAddAddress } from "../hooks";
import { lineTotal } from "../lib";
import { type } from "../type";
import { Amount } from "./Amount";

/** Numbered checkout step (1 Address · 2 Items & shipping · 3 Payment). */
export function CheckoutStep({
  n,
  id,
  title,
  done,
  aside,
  children,
}: {
  n: number;
  id: string;
  title: string;
  done?: boolean;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <h2 id={id} className={`flex items-center gap-3 ${type.h3}`}>
          <span
            aria-hidden="true"
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm ${done ? "bg-primary text-primary-foreground" : "border border-border"}`}
          >
            {done ? <Check size={16} /> : n}
          </span>
          <span>
            <span className="sr-only">Step {n}: </span>
            {title}
            {done && <span className="sr-only"> (done)</span>}
          </span>
        </h2>
        {aside}
      </div>
      <div>{children}</div>
    </section>
  );
}

/**
 * Inline new-address fields (step 1). Shown open when the shopper has no address yet.
 * A field group, not a <form>: it sits inside the checkout form, and forms cannot nest.
 * Enter in a field saves the address instead of placing the order.
 */
export function AddressForm({
  onDone,
  onCancel,
}: {
  onDone: (id: string) => void;
  onCancel?: () => void;
}) {
  const add = useAddAddress();
  const [values, setValues] = useState({
    recipient: "",
    phone: "",
    address: "",
  });
  const [error, setError] = useState<string>();
  async function save() {
    const input = {
      recipient: values.recipient.trim(),
      phone: values.phone.trim(),
      address: values.address.trim(),
    };
    if (!input.recipient || !input.phone || !input.address) {
      setError("Fill in the recipient, phone and address.");
      return;
    }
    if (!/^0\d{9}$/.test(input.phone)) {
      setError("Enter a 10-digit phone number starting with 0.");
      return;
    }
    setError(undefined);
    try {
      const created = await add.mutateAsync(input);
      onDone(created.id);
    } catch (err) {
      setError(errorMessage(err, "Could not save the address."));
    }
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    void save();
  };
  const field = (name: keyof typeof values) => ({
    name,
    value: values[name],
    onChange: (e: ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [name]: e.target.value })),
    onKeyDown,
    "aria-invalid": !!error && !values[name].trim(),
    className:
      "mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base",
  });
  return (
    <div
      role="group"
      aria-label="New address"
      className="grid gap-3 sm:grid-cols-2"
    >
      <label className="block text-sm font-medium">
        Recipient
        <input autoComplete="name" {...field("recipient")} />
      </label>
      <label className="block text-sm font-medium">
        Phone
        <input
          inputMode="tel"
          autoComplete="tel"
          placeholder="0901234567"
          {...field("phone")}
        />
      </label>
      <label className="block text-sm font-medium sm:col-span-2">
        Address
        <input
          autoComplete="street-address"
          placeholder="12 Le Loi, District 1, Ho Chi Minh City"
          {...field("address")}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={add.isPending}
          className="min-h-11 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {add.isPending ? "Saving…" : "Save and use this address"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-md px-4 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

/** One seller's lines in step 2: thumbnail, name, variant, price × qty, line total. */
export function CheckoutSellerItems({
  seller,
  items,
  subtotal,
  children,
}: {
  seller: { id: string; name: string; slug?: string };
  items: CartItem[];
  subtotal: MoneyValue;
  children?: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`co-${seller.id}`}
      className="rounded-lg border border-border"
    >
      <h3
        id={`co-${seller.id}`}
        className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold"
      >
        <Store size={16} aria-hidden="true" />
        {seller.slug ? (
          <Link to={`/shop/${seller.slug}`} className="hover:underline">
            {seller.name}
          </Link>
        ) : (
          seller.name
        )}
      </h3>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li
            key={item.id}
            className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 text-sm"
          >
            <img
              src={item.imageUrl}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 rounded-md bg-muted object-cover"
            />
            <span className="min-w-0">
              <span className="line-clamp-2 font-medium">{item.name}</span>
              <span className="block text-xs text-muted-foreground">
                {item.variantLabel}
                {item.variantLabel && " · "}
                <span className="tabular-nums">
                  <Amount amount={item.unitPrice} /> × {item.quantity}
                </span>
              </span>
            </span>
            <span className="font-medium">
              <span className="sr-only">Line total </span>
              <Amount amount={lineTotal(item.unitPrice, item.quantity)} />
            </span>
          </li>
        ))}
      </ul>
      <div className="space-y-3 border-t border-border px-4 py-3">
        {children}
        <p className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Items subtotal ({items.reduce((n, i) => n + i.quantity, 0)})
          </span>
          <strong>
            <Amount amount={subtotal} />
          </strong>
        </p>
      </div>
    </section>
  );
}

/** Mobile bottom bar (above the shopper tab bar): total + Place order + why it is blocked. */
export function CheckoutBar({
  label,
  total,
  reason,
  action,
}: {
  label: string;
  total: MoneyValue;
  reason?: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 border-t border-border bg-background px-4 py-3 md:bottom-0 md:left-52 md:px-8">
      {reason && <div className="mb-2 text-xs">{reason}</div>}
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-sm">
          <span className="block text-xs text-muted-foreground">{label}</span>
          <strong className="text-lg">
            <Amount amount={total} />
          </strong>
        </p>
        <div className="shrink-0">{action}</div>
      </div>
    </div>
  );
}
