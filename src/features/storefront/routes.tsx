import { createElement, type ComponentType } from "react";
import type { RouteObject } from "react-router-dom";
import { Page, type PageWidth } from "../../components/layout/Page";

/**
 * Lazy page inside the shared `<Page>` (TASK-028 B, DESIGN-PLAN-v2 §4.1): browsing pages are
 * `wide` (1440), single-item pages `content` (1200), one-task flows `narrow` (720).
 */
const page =
  (width: PageWidth, load: () => Promise<{ default: ComponentType }>) =>
  async () => {
    const Content = (await load()).default;
    function StorefrontPage() {
      return createElement(
        Page,
        { width, className: "py-5 md:py-8" },
        createElement(Content),
      );
    }
    return { Component: StorefrontPage };
  };

/**
 * Storefront routes (relative paths, mount under the shopper shell at `/`).
 * Public routes allow guests; shopper routes need a signed-in shopper (wrap them in the
 * shopper guard). `storefrontRoutes` is both lists together.
 */
export const storefrontPublicRoutes: RouteObject[] = [
  { index: true, lazy: page("wide", () => import("./pages/HomePage")) },
  { path: "search", lazy: page("wide", () => import("./pages/SearchPage")) },
  { path: "c/:slug", lazy: page("wide", () => import("./pages/SearchPage")) },
  {
    path: "p/:slug",
    lazy: page("content", () => import("./pages/ProductPage")),
  },
  {
    path: "shop/:seller",
    lazy: page("wide", () => import("./pages/ShopPage")),
  },
];

export const storefrontShopperRoutes: RouteObject[] = [
  { path: "cart", lazy: page("content", () => import("./pages/CartPage")) },
  {
    path: "checkout",
    lazy: page("content", () => import("./pages/CheckoutPage")),
  },
  {
    path: "pay/:intentId",
    lazy: page("narrow", () => import("./pages/PaymentPage")),
  },
  {
    path: "orders/success/:orderId",
    lazy: page("narrow", () => import("./pages/OrderSuccessPage")),
  },
  {
    path: "me/orders",
    lazy: page("wide", () => import("./pages/MyOrdersPage")),
  },
  {
    path: "me/orders/:id",
    lazy: page("content", () => import("./pages/OrderDetailPage")),
  },
];

export const storefrontRoutes: RouteObject[] = [
  ...storefrontPublicRoutes,
  ...storefrontShopperRoutes,
];
