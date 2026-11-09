import { createElement, type ComponentType } from "react";
import type { RouteObject } from "react-router-dom";
import { PageContainer } from "./components/PageContainer";

/** Lazy page wrapped in the shared storefront container. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => {
  const Page = (await load()).default;
  function ContainedPage() {
    return createElement(PageContainer, null, createElement(Page));
  }
  return { Component: ContainedPage };
};

/**
 * Storefront routes (relative paths, mount under the shopper shell at `/`).
 * Public routes allow guests; shopper routes need a signed-in shopper (wrap them in the
 * shopper guard). `storefrontRoutes` is both lists together.
 */
export const storefrontPublicRoutes: RouteObject[] = [
  { index: true, lazy: page(() => import("./pages/HomePage")) },
  { path: "search", lazy: page(() => import("./pages/SearchPage")) },
  { path: "c/:slug", lazy: page(() => import("./pages/SearchPage")) },
  { path: "p/:slug", lazy: page(() => import("./pages/ProductPage")) },
  { path: "shop/:seller", lazy: page(() => import("./pages/ShopPage")) },
];

export const storefrontShopperRoutes: RouteObject[] = [
  { path: "cart", lazy: page(() => import("./pages/CartPage")) },
  { path: "checkout", lazy: page(() => import("./pages/CheckoutPage")) },
  { path: "pay/:intentId", lazy: page(() => import("./pages/PaymentPage")) },
  {
    path: "orders/success/:orderId",
    lazy: page(() => import("./pages/OrderSuccessPage")),
  },
  { path: "me/orders", lazy: page(() => import("./pages/MyOrdersPage")) },
  {
    path: "me/orders/:id",
    lazy: page(() => import("./pages/OrderDetailPage")),
  },
];

export const storefrontRoutes: RouteObject[] = [
  ...storefrontPublicRoutes,
  ...storefrontShopperRoutes,
];
