import type { RouteObject } from "react-router-dom";
import { SellerShell } from "./SellerShell";
export { SellerShell } from "./SellerShell";
// Route objects are exported with the shell for the host application's router.
// eslint-disable-next-line react-refresh/only-export-components
export const sellerRoutes: RouteObject[] = [
  {
    path: "/seller",
    element: <SellerShell />,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import("./pages")).Dashboard }),
      },
      {
        path: "onboarding",
        lazy: async () => ({ Component: (await import("./pages")).Onboarding }),
      },
      {
        path: "products",
        lazy: async () => ({ Component: (await import("./pages")).Products }),
      },
      {
        path: "products/new",
        lazy: async () => ({
          Component: (await import("./pages")).ProductEditor,
        }),
      },
      {
        path: "products/:id",
        lazy: async () => ({
          Component: (await import("./pages")).ProductEditor,
        }),
      },
      {
        path: "inventory",
        lazy: async () => ({ Component: (await import("./pages")).Inventory }),
      },
      {
        path: "orders",
        lazy: async () => ({ Component: (await import("./pages")).Orders }),
      },
      {
        path: "orders/:id",
        lazy: async () => ({
          Component: (await import("./pages")).OrderDetail,
        }),
      },
      {
        path: "settings",
        lazy: async () => ({ Component: (await import("./pages")).Settings }),
      },
    ],
  },
];
