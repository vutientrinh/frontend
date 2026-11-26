import type { RouteObject } from "react-router-dom";
import { SellerShell } from "./SellerShell";
import { Page, PageHeader } from "../../components/layout/Page";
export { SellerShell } from "./SellerShell";
function SellerHydrateFallback() {
  return (
    <Page width="wide" className="py-5 md:py-8">
      <p role="status">Loading seller workspace…</p>
    </Page>
  );
}
function SellerDashboardHydrateFallback() {
  return (
    <Page width="wide" className="py-5 md:py-8">
      <PageHeader title="Seller dashboard" />
      <p role="status">Loading seller dashboard…</p>
    </Page>
  );
}
const sellerPageHydration = { HydrateFallback: SellerHydrateFallback };
// Route objects are exported with the shell for the host application's router.
// eslint-disable-next-line react-refresh/only-export-components
export const sellerRoutes: RouteObject[] = [
  {
    path: "/seller",
    element: <SellerShell />,
    children: [
      {
        index: true,
        HydrateFallback: SellerDashboardHydrateFallback,
        lazy: async () => ({
          Component: (await import("./dashboard")).Dashboard,
        }),
      },
      {
        path: "onboarding",
        ...sellerPageHydration,
        lazy: async () => ({
          Component: (await import("./onboarding")).Onboarding,
        }),
      },
      {
        path: "products",
        ...sellerPageHydration,
        lazy: async () => ({
          Component: (await import("./products")).Products,
        }),
      },
      {
        path: "products/new",
        ...sellerPageHydration,
        lazy: async () => ({
          Component: (await import("./product-editor")).ProductEditor,
        }),
      },
      {
        path: "products/:id",
        ...sellerPageHydration,
        lazy: async () => ({
          Component: (await import("./product-editor")).ProductEditor,
        }),
      },
      {
        path: "inventory",
        ...sellerPageHydration,
        lazy: async () => ({
          Component: (await import("./inventory")).Inventory,
        }),
      },
      {
        path: "orders",
        ...sellerPageHydration,
        lazy: async () => ({ Component: (await import("./orders")).Orders }),
      },
      {
        path: "orders/:id",
        ...sellerPageHydration,
        lazy: async () => ({
          Component: (await import("./order-detail")).OrderDetail,
        }),
      },
      {
        path: "settings",
        ...sellerPageHydration,
        lazy: async () => ({
          Component: (await import("./settings")).Settings,
        }),
      },
    ],
  },
];
