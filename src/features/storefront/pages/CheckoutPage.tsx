import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Big from "big.js";
import {
  ArrowLeft,
  Clock,
  QrCode,
  ShieldCheck,
  TicketPercent,
  Wallet,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ErrorState } from "../../../components/shared";
import { useCart, useCheckout, useCheckoutQuote } from "../../commerce/api";
import type {
  CartItem,
  Money as MoneyValue,
  PaymentMethod,
  SellerRef,
  ShippingOption,
} from "../../commerce/types";
import {
  AddressForm,
  CheckoutBar,
  CheckoutSellerItems,
  CheckoutStep,
} from "../components/CheckoutParts";
import { OrderSummary } from "../components/OrderSummary";
import { SavedAddressPicker } from "../components/SavedAddressPicker";
import { EmptyCart, ListSkeleton } from "../components/States";
import {
  errorMessage,
  useAddresses,
  useIdempotencyKey,
  useMinWidth,
  useWalletBalance,
} from "../hooks";
import { Amount } from "../components/Amount";
import { isPositive, lineTotal, sumMoney } from "../lib";
import { type } from "../type";

const RESERVATION_MINUTES = 15;
const backLink =
  "inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline";

const subtotalOf = (items: CartItem[]) =>
  sumMoney(items.map((i) => lineTotal(i.unitPrice, i.quantity)));

function MethodOption({
  checked,
  onSelect,
  icon,
  title,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer gap-3 rounded-lg border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${checked ? "border-primary bg-[color-mix(in_oklch,var(--primary)_10%,transparent)]" : "border-border hover:bg-muted"}`}
    >
      <input
        type="radio"
        name="payment-method"
        checked={checked}
        onChange={onSelect}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
      />
      <span className="min-w-0 flex-1 text-sm">
        <span className="flex items-center gap-2 font-medium">
          {icon} {title}
        </span>
        {children}
      </span>
    </label>
  );
}

/**
 * W-16 Checkout in three steps: 1 Address · 2 Items & shipping · 3 Payment.
 * Items and their subtotal come from the cart straight away; the server quote (shipping,
 * discount, total) follows once there is an address and is recomputed on every change.
 */
export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const desktop = useMinWidth(1024);
  const preferred = (location.state as { method?: PaymentMethod } | null)
    ?.method;
  const cart = useCart();
  const addresses = useAddresses();
  const wallet = useWalletBalance();
  const quote = useCheckoutQuote();
  const checkout = useCheckout();

  const [chosenAddress, setChosenAddress] = useState<string>();
  const [addingAddress, setAddingAddress] = useState(false);
  const [shipping, setShipping] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<PaymentMethod>(preferred ?? "WALLET");
  const [voucherDraft, setVoucherDraft] = useState("");
  const [voucherCode, setVoucherCode] = useState<string>();

  const cartGroups = (cart.data?.groups ?? [])
    .map((g) => ({
      seller: g.seller,
      items: g.items.filter((i) => i.selected && i.available),
    }))
    .filter((g) => g.items.length);
  const cartItemIds = cartGroups.flatMap((g) => g.items.map((i) => i.id));
  const itemCount = cartGroups
    .flatMap((g) => g.items)
    .reduce((n, i) => n + i.quantity, 0);
  const itemsSubtotal = subtotalOf(cartGroups.flatMap((g) => g.items));
  const list = addresses.data ?? [];
  const addressId =
    chosenAddress ?? (list.find((a) => a.isDefault) ?? list[0])?.id;
  const showAddressForm =
    addingAddress || (addresses.isSuccess && !list.length);

  const quoteInput = JSON.stringify({
    cartItemIds,
    addressId,
    shipping,
    voucherCode,
  });
  const { mutate: requestQuote } = quote;
  useEffect(() => {
    const input = JSON.parse(quoteInput) as {
      cartItemIds: string[];
      addressId?: string;
      shipping: Record<string, string>;
      voucherCode?: string;
    };
    if (!input.addressId || !input.cartItemIds.length) return;
    requestQuote({
      cartItemIds: input.cartItemIds,
      addressId: input.addressId,
      shippingOptionIds: input.shipping,
      voucherCode: input.voucherCode,
    });
  }, [quoteInput, requestQuote]);

  // A quote for an older input (e.g. before the address changed) is not shown as current.
  const q = addressId ? quote.data : undefined;
  const shippingOptionIds = Object.fromEntries(
    (q?.groups ?? []).map((g) => [
      g.seller.id,
      shipping[g.seller.id] ?? g.selectedShippingOptionId,
    ]),
  );
  const body = JSON.stringify({
    cartItemIds,
    addressId,
    shippingOptionIds,
    method,
    notes,
  });
  const idempotency = useIdempotencyKey(body);

  const balance = q?.walletAvailable ?? wallet.data?.availableBalance;
  const amountDue = q?.total ?? itemsSubtotal;
  const shortBy =
    balance !== undefined && new Big(amountDue).gt(balance)
      ? new Big(amountDue).minus(balance).toFixed(0)
      : null;
  const walletBlocked = method === "WALLET" && !!shortBy;

  const blockReason = !addressId
    ? "Add a delivery address to place your order."
    : quote.isError
      ? "We could not price your order. Try again above."
      : !q
        ? "Calculating shipping…"
        : walletBlocked
          ? "Your wallet balance is too low. Top up or pay with VietQR."
          : undefined;

  async function placeOrder(e: FormEvent) {
    e.preventDefault();
    if (!addressId || !q || blockReason) return;
    try {
      const result = await checkout.mutateAsync({
        cartItemIds,
        addressId,
        shippingOptionIds,
        paymentMethod: method,
        notes: Object.fromEntries(
          Object.entries(notes).filter(([, v]) => v.trim()),
        ),
        idempotencyKey: idempotency.key,
      });
      navigate(`/pay/${result.paymentIntent.id}`, {
        replace: true,
        state: { checkout: result },
      });
    } catch {
      // Error shown next to the button; keep the key so a retry of the same order is idempotent.
    }
  }

  function applyVoucher() {
    const code = voucherDraft.trim().toUpperCase();
    setVoucherCode(code || undefined);
  }

  const header = (
    <header className="space-y-1">
      <Link to="/cart" className={backLink}>
        <ArrowLeft size={16} aria-hidden="true" />
        Back to cart
      </Link>
      <h1 id="checkout-title" className={type.h1}>
        Checkout
      </h1>
    </header>
  );

  if (cart.isError || addresses.isError)
    return (
      <ErrorState
        message="Could not load checkout."
        retry={() => {
          void cart.refetch();
          void addresses.refetch();
        }}
      />
    );
  if (cart.isLoading || addresses.isLoading)
    return (
      <div className="space-y-4">
        {header}
        <ListSkeleton label="Loading checkout" />
      </div>
    );
  if (!cartItemIds.length)
    return (
      <div className="space-y-4">
        {header}
        {cart.data?.groups.length ? (
          <p>
            No items are selected.{" "}
            <Link to="/cart" className="text-primary">
              Back to cart
            </Link>
          </p>
        ) : (
          <EmptyCart />
        )}
      </div>
    );

  const reasonNode = (checkout.isError || blockReason) && (
    <p
      id="place-order-reason"
      className={`text-sm ${checkout.isError ? "text-destructive" : "text-muted-foreground"}`}
      role={checkout.isError ? "alert" : undefined}
    >
      {checkout.isError
        ? errorMessage(checkout.error, "Could not place the order.")
        : blockReason}
    </p>
  );
  const placeButton = (
    <button
      type="submit"
      disabled={!!blockReason || checkout.isPending}
      aria-describedby={reasonNode ? "place-order-reason" : undefined}
      className="min-h-12 w-full rounded-md bg-primary px-6 text-base font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {checkout.isPending ? "Placing order…" : "Place order"}
    </button>
  );
  const voucher = (
    <div className="space-y-1">
      <label htmlFor="voucher" className="flex items-center gap-1 text-sm">
        <TicketPercent size={16} aria-hidden="true" />
        Voucher code
      </label>
      <div className="flex gap-2">
        <input
          id="voucher"
          value={voucherDraft}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setVoucherDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyVoucher();
            }
          }}
          aria-describedby={voucherCode ? "voucher-status" : undefined}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-base uppercase"
        />
        <button
          type="button"
          onClick={applyVoucher}
          disabled={!voucherDraft.trim()}
          className="min-h-11 shrink-0 rounded-md border border-input px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          Apply
        </button>
      </div>
      {voucherCode && (
        <p id="voucher-status" role="status" className="text-xs">
          {!addressId ? (
            <span className="text-muted-foreground">
              {voucherCode} will be checked once you add an address.
            </span>
          ) : !q || quote.isPending ? (
            <span className="text-muted-foreground">
              Checking {voucherCode}…
            </span>
          ) : isPositive(q.discount) ? (
            <span>
              <span className="text-success">{voucherCode} applied:</span>{" "}
              <Amount amount={q.discount} sign="minus" />
            </span>
          ) : (
            <span className="text-destructive">
              {voucherCode} can’t be applied to this order.
            </span>
          )}
        </p>
      )}
    </div>
  );
  const summary = (
    <OrderSummary
      itemCount={itemCount}
      itemsTotal={q?.itemsTotal ?? itemsSubtotal}
      shippingTotal={q?.shippingTotal}
      shippingNote={addressId ? "Calculating…" : "Add an address first"}
      discount={q?.discount}
      total={q?.total ?? itemsSubtotal}
      totalLabel={q ? "Total" : "Total before shipping"}
      before={voucher}
      totalSize="display"
      footnote={
        <span className="space-y-1">
          <span className="flex items-center gap-1">
            <ShieldCheck size={12} aria-hidden="true" />
            Your payment is held safely until you confirm you received the
            order.
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} aria-hidden="true" />
            Stock is held for {RESERVATION_MINUTES}:00 after you place the
            order.
          </span>
        </span>
      }
    >
      {desktop && (
        <div className="space-y-2">
          {placeButton}
          {reasonNode}
        </div>
      )}
    </OrderSummary>
  );

  const groups: {
    seller: SellerRef;
    items: CartItem[];
    subtotal: MoneyValue;
    shippingOptions?: ShippingOption[];
  }[] = q
    ? q.groups
    : cartGroups.map((g) => ({ ...g, subtotal: subtotalOf(g.items) }));

  return (
    <form
      onSubmit={(e) => void placeOrder(e)}
      className="space-y-6 pb-40 lg:pb-0"
      aria-labelledby="checkout-title"
    >
      {header}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
        <div className="space-y-6">
          <CheckoutStep
            n={1}
            id="step-address"
            title="Delivery address"
            done={!!addressId && !showAddressForm}
          >
            {list.length > 0 && (
              <SavedAddressPicker
                addresses={list}
                value={addressId}
                onChange={setChosenAddress}
                onAddNew={
                  addingAddress ? undefined : () => setAddingAddress(true)
                }
                hideLegend
              />
            )}
            {showAddressForm && (
              <div
                className={
                  list.length ? "mt-4 border-t border-border pt-4" : ""
                }
              >
                {!list.length && (
                  <p className="mb-3 text-sm text-muted-foreground">
                    Where should we deliver? Your address is saved for next
                    time.
                  </p>
                )}
                <AddressForm
                  onDone={(id) => {
                    setChosenAddress(id);
                    setAddingAddress(false);
                  }}
                  onCancel={
                    list.length ? () => setAddingAddress(false) : undefined
                  }
                />
              </div>
            )}
          </CheckoutStep>

          <CheckoutStep
            n={2}
            id="step-items"
            title="Items & shipping"
            done={!!q}
            aside={
              <span className="text-sm text-muted-foreground">
                {itemCount} {itemCount === 1 ? "item" : "items"} from{" "}
                {groups.length} {groups.length === 1 ? "shop" : "shops"}
              </span>
            }
          >
            <div className="space-y-4">
              {quote.isError && addressId && (
                <ErrorState
                  message={errorMessage(
                    quote.error,
                    "Could not price your order.",
                  )}
                  retry={() =>
                    requestQuote({
                      cartItemIds,
                      addressId,
                      shippingOptionIds: shipping,
                      voucherCode,
                    })
                  }
                />
              )}
              {q?.warnings.map((w) => (
                <p
                  key={w}
                  role="status"
                  className="rounded-md bg-muted p-3 text-sm"
                >
                  {w}
                </p>
              ))}
              {groups.map((group) => {
                const options = group.shippingOptions;
                return (
                  <CheckoutSellerItems
                    key={group.seller.id}
                    seller={group.seller}
                    items={group.items}
                    subtotal={group.subtotal}
                  >
                    {options ? (
                      <fieldset>
                        <legend className="mb-1 text-sm font-medium">
                          Shipping
                        </legend>
                        {options.map((option) => (
                          <label
                            key={option.id}
                            className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"
                          >
                            <input
                              type="radio"
                              name={`shipping-${group.seller.id}`}
                              checked={
                                shippingOptionIds[group.seller.id] === option.id
                              }
                              onChange={() =>
                                setShipping((s) => ({
                                  ...s,
                                  [group.seller.id]: option.id,
                                }))
                              }
                              className="h-4 w-4 accent-[var(--primary)]"
                            />
                            <span className="flex-1">
                              {option.name}{" "}
                              <span className="text-muted-foreground">
                                ({option.etaDays}{" "}
                                {option.etaDays === 1 ? "day" : "days"})
                              </span>
                            </span>
                            <Amount amount={option.fee} />
                          </label>
                        ))}
                      </fieldset>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {addressId
                          ? "Calculating shipping…"
                          : "Add a delivery address to see shipping options."}
                      </p>
                    )}
                    <label className="block text-sm">
                      Note to {group.seller.name}{" "}
                      <span className="text-muted-foreground">(optional)</span>
                      <input
                        value={notes[group.seller.id] ?? ""}
                        maxLength={200}
                        onChange={(e) =>
                          setNotes((n) => ({
                            ...n,
                            [group.seller.id]: e.target.value,
                          }))
                        }
                        className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3"
                      />
                    </label>
                  </CheckoutSellerItems>
                );
              })}
            </div>
          </CheckoutStep>

          <CheckoutStep n={3} id="step-payment" title="Payment">
            <fieldset className="space-y-2">
              <legend className="sr-only">Payment method</legend>
              <MethodOption
                checked={method === "WALLET"}
                onSelect={() => setMethod("WALLET")}
                icon={<Wallet size={16} aria-hidden="true" />}
                title="Wallet"
              >
                <span className="block text-muted-foreground">
                  {balance !== undefined ? (
                    <>
                      Balance <Amount amount={balance} />
                    </>
                  ) : wallet.isError ? (
                    "Balance unavailable"
                  ) : (
                    "Checking balance…"
                  )}
                </span>
                {shortBy && (
                  <span className="mt-1 inline-block rounded-sm border border-border px-1.5 text-xs">
                    Not enough balance
                  </span>
                )}
              </MethodOption>
              <MethodOption
                checked={method === "VIETQR"}
                onSelect={() => setMethod("VIETQR")}
                icon={<QrCode size={16} aria-hidden="true" />}
                title="VietQR bank transfer"
              >
                <span className="block text-muted-foreground">
                  Scan with any banking app
                </span>
              </MethodOption>
              {walletBlocked && shortBy && (
                <div
                  role="alert"
                  className="rounded-md border border-border bg-muted p-3 text-sm"
                >
                  <p>
                    Your wallet is short by {q ? "" : "at least "}
                    <Amount amount={shortBy} />.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3">
                    <Link
                      to={`/wallet/top-up?amount=${shortBy}`}
                      className="inline-flex min-h-11 items-center gap-1 rounded-md bg-primary px-4 font-medium text-primary-foreground hover:opacity-90"
                    >
                      Top up <Amount amount={shortBy} />
                    </Link>
                    <span className="text-muted-foreground">
                      Or pay with VietQR instead.
                    </span>
                  </div>
                </div>
              )}
            </fieldset>
          </CheckoutStep>
          {!desktop && summary}
        </div>
        {desktop && <div className="lg:sticky lg:top-4">{summary}</div>}
      </div>
      {!desktop && (
        <CheckoutBar
          label={q ? "Total" : "Total before shipping"}
          total={q?.total ?? itemsSubtotal}
          reason={reasonNode}
          action={<div className="w-40">{placeButton}</div>}
        />
      )}
    </form>
  );
}
