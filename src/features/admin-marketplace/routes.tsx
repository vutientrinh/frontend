import type { ComponentType } from "react";
import {
  FolderTree,
  ShieldCheck,
  ShoppingBag,
  Store,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { RouteObject } from "react-router-dom";

const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

/**
 * Admin marketplace routes (A-02/03/10–15). Paths are relative to `/admin`: mount them as
 * children of the admin shell route. Pages link to absolute `/admin/marketplace/...` URLs.
 */
export const adminMarketplaceRoutes: RouteObject[] = [
  {
    path: "marketplace/customers",
    lazy: page(() => import("./pages/CustomersPage")),
  },
  {
    path: "marketplace/customers/:id",
    lazy: page(() => import("./pages/CustomerDetailPage")),
  },
  {
    path: "marketplace/sellers",
    lazy: page(() => import("./pages/SellersPage")),
  },
  {
    path: "marketplace/sellers/:id",
    lazy: page(() => import("./pages/SellerDetailPage")),
  },
  {
    path: "marketplace/categories",
    lazy: page(() => import("./pages/CategoriesPage")),
  },
  {
    path: "marketplace/moderation",
    lazy: page(() => import("./pages/ModerationPage")),
  },
  {
    path: "marketplace/orders",
    lazy: page(() => import("./pages/OrdersPage")),
  },
  {
    path: "marketplace/orders/:id",
    lazy: page(() => import("./pages/OrderDetailPage")),
  },
];

export interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Sidebar entries for the admin shell (absolute paths). */
export const adminMarketplaceNav: AdminNavItem[] = [
  { to: "/admin/marketplace/customers", label: "Customers", icon: UserRound },
  { to: "/admin/marketplace/sellers", label: "Sellers", icon: Store },
  {
    to: "/admin/marketplace/categories",
    label: "Categories",
    icon: FolderTree,
  },
  {
    to: "/admin/marketplace/moderation",
    label: "Moderation",
    icon: ShieldCheck,
  },
  {
    to: "/admin/marketplace/orders",
    label: "Marketplace orders",
    icon: ShoppingBag,
  },
];
