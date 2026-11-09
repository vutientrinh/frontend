import { useEffect, useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ApiError, request } from "../banking/client";
import { useOptionalAuth } from "../banking/AuthContext";
import type { Address, Wallet } from "../banking/types";
import { useAddCartItem } from "../commerce/api";
import type {
  OrderDetail,
  PageResponse,
  ProductDetail,
  ProductSummary,
  ShopperOrder,
  ShopperOrderTab,
} from "../commerce/types";

export const addressesKey = ["me", "addresses"] as const;

/** Same endpoint and query key as the Account screen, so both stay in sync. */
export const useAddresses = (enabled = true) =>
  useQuery({
    queryKey: addressesKey,
    queryFn: () => request<Address[]>("/me/addresses"),
    enabled,
  });

/** Wallet balance for checkout; same key and endpoint as the Wallet screen. */
export const useWalletBalance = (enabled = true) =>
  useQuery({
    queryKey: ["wallet"],
    queryFn: () => request<Wallet>("/wallets/me"),
    enabled,
  });

export function useAddAddress() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Address, "id" | "isDefault">) =>
      request<Address>("/me/addresses", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: addressesKey }),
  });
}

export function errorMessage(
  error: unknown,
  fallback = "Something went wrong.",
) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export const isUnauthorized = (error: unknown) =>
  error instanceof ApiError && error.status === 401;

/** Returns a function that sends guests to sign in and back here afterwards. */
export function useSignInRedirect() {
  const auth = useOptionalAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const signedIn = !!auth?.user;
  return {
    signedIn,
    loading: !!auth?.loading,
    requireSignIn: () => {
      if (signedIn) return false;
      navigate("/login", {
        state: { from: location.pathname + location.search },
      });
      return true;
    },
  };
}

/** Stable per-attempt idempotency key: a new key only when the request body changes. */
export function useIdempotencyKey(body: string) {
  const [nonce, setNonce] = useState(() => crypto.randomUUID());
  let hash = 5381;
  for (let i = 0; i < body.length; i++)
    hash = ((hash << 5) + hash + body.charCodeAt(i)) | 0;
  return {
    key: `${nonce}-${(hash >>> 0).toString(36)}`,
    renew: () => setNonce(crypto.randomUUID()),
  };
}

/**
 * "Add to cart" from a product card (S-03). Cards have no variant, so we load the product:
 * one in-stock variant → add it at once; several → `picking` holds the product for the
 * quick-pick dialog; none → say it is sold out.
 */
export function useQuickAdd() {
  const client = useQueryClient();
  const add = useAddCartItem();
  const navigate = useNavigate();
  const { requireSignIn } = useSignInRedirect();
  const [pendingId, setPendingId] = useState<string>();
  const [picking, setPicking] = useState<ProductDetail>();
  return {
    pendingId,
    picking,
    closePicker: () => setPicking(undefined),
    quickAdd: async (product: ProductSummary) => {
      if (requireSignIn()) return;
      setPendingId(product.id);
      try {
        const detail = await client.fetchQuery({
          queryKey: ["commerce", "product", product.slug],
          queryFn: () =>
            request<ProductDetail>(
              `/catalog/products/${encodeURIComponent(product.slug)}`,
            ),
        });
        const inStock = detail.variants.filter((v) => v.stock > 0);
        if (!inStock.length) {
          toast.error(`${product.name} is sold out.`);
          return;
        }
        if (inStock.length > 1) {
          setPicking(detail);
          return;
        }
        await add.mutateAsync({ variantId: inStock[0].id, quantity: 1 });
        addedToCartToast(product.name, navigate);
      } catch (error) {
        toast.error(errorMessage(error, "Could not add to cart."));
      } finally {
        setPendingId(undefined);
      }
    },
  };
}

/** True while the viewport matches `(min-width: <px>px)`; re-renders on change. */
export function useMinWidth(px: number) {
  const query = `(min-width: ${px}px)`;
  const [matches, setMatches] = useState(
    () => window.matchMedia?.(query).matches ?? false,
  );
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const change = () => setMatches(media.matches);
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, [query]);
  return matches;
}

/** "Added to cart" toast with a way to the cart (S-06). */
export function addedToCartToast(name: string, navigate: (to: string) => void) {
  toast.success(`Added ${name} to cart`, {
    action: { label: "View cart", onClick: () => navigate("/cart") },
  });
}

/**
 * Order count per tab for the W-19 tab bar. The contract has no counts endpoint, so each tab
 * asks for one row and reads `totalElements` (cheap; same query keys as the list, so
 * order mutations refresh them too). `undefined` tab = all orders.
 */
export function useOrderTabCounts(tabs: (ShopperOrderTab | undefined)[]) {
  const results = useQueries({
    queries: tabs.map((tab) => {
      const params = tab ? { tab, page: 0, size: 1 } : { page: 0, size: 1 };
      return {
        queryKey: ["commerce", "orders", params],
        queryFn: () =>
          request<PageResponse<ShopperOrder>>(
            `/me/orders?${new URLSearchParams(
              Object.entries(params).map(([k, v]) => [k, String(v)]),
            )}`,
          ),
      };
    }),
  });
  return tabs.map((_, i) => results[i].data?.totalElements);
}

/** Adds every still-sold line of a past order back to the cart, then offers the cart. */
export function useBuyAgain() {
  const client = useQueryClient();
  const add = useAddCartItem();
  const navigate = useNavigate();
  const [pendingId, setPendingId] = useState<string>();
  return {
    pendingId,
    buyAgain: async (orderId: string) => {
      setPendingId(orderId);
      try {
        const order = await client.fetchQuery({
          queryKey: ["commerce", "order", orderId],
          queryFn: () => request<OrderDetail>(`/me/orders/${orderId}`),
        });
        const lines = order.items.filter((i) => i.variantId);
        let added = 0;
        for (const line of lines) {
          try {
            await add.mutateAsync({
              variantId: line.variantId!,
              quantity: line.quantity,
            });
            added++;
          } catch {
            /* sold out or removed: reported below */
          }
        }
        if (!added) {
          toast.error("These items are no longer available.");
          return;
        }
        const skipped = order.items.length - added;
        toast.success(
          skipped
            ? `Added ${added} of ${order.items.length} items to cart. The rest are no longer available.`
            : `Added ${added} ${added === 1 ? "item" : "items"} to cart`,
          { action: { label: "View cart", onClick: () => navigate("/cart") } },
        );
      } catch (error) {
        toast.error(errorMessage(error, "Could not add these items."));
      } finally {
        setPendingId(undefined);
      }
    },
  };
}
