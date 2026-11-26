import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Page } from "../../components/layout/Page";
import { ThemeSwitch } from "../../components/layout/ThemeSwitch";
import { Logo } from "@/components/brand/Logo";
import { brand } from "../../config/brand";
import { useAuth } from "../banking/AuthContext";
import { useSellerDashboard, useSellerSettings } from "../commerce/api";
import { useLowStockCount } from "./seller-utils";
import {
  Box,
  ClipboardList,
  Bell,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
} from "lucide-react";
const links = [
  { to: "/seller", label: "Dashboard", Icon: LayoutDashboard, end: true },
  { to: "/seller/products", label: "Products", Icon: Package },
  { to: "/seller/inventory", label: "Inventory", Icon: Box },
  { to: "/seller/orders", label: "Orders", Icon: ClipboardList },
  { to: "/seller/settings", label: "Settings", Icon: Settings },
];
export function SellerShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const settings = useSellerSettings();
  const dashboard = useSellerDashboard();
  const lowStock = useLowStockCount() ?? 0;
  const pageWidth = /^\/seller\/products\/(new|[^/]+)$/.test(pathname)
    ? "full"
    : pathname === "/seller/settings" || pathname === "/seller/onboarding"
      ? "narrow"
      : /^\/seller\/orders\/[^/]+$/.test(pathname)
        ? "content"
        : "wide";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#seller-main" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      {/* Sidebar shell: full-width bar, logo on the sidebar's icon axis (TASK-036 G4). */}
      <header className="sticky top-0 z-40 h-16 border-b border-border bg-background">
        <div className="flex h-full min-w-0 items-center justify-between gap-2 px-4 md:pr-6 xl:pl-6">
          <div className="flex min-w-0 items-center gap-2">
            <Link to="/seller" aria-label={`${brand.name} seller portal`}>
              <Logo showWordmark={false} />
            </Link>
            <span className="max-w-28 truncate text-sm font-medium sm:max-w-48 xl:max-w-64">
              {settings.data?.shopName || "Your shop"}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <details className="relative">
              <summary
                aria-label={`Notifications${dashboard.data ? `, ${dashboard.data.toConfirm} orders to confirm and ${lowStock} low stock variants` : ""}`}
                className="relative grid h-11 w-11 cursor-pointer list-none place-items-center rounded-md hover:bg-muted [&::-webkit-details-marker]:hidden"
              >
                <Bell size={18} aria-hidden="true" />
                {!!(dashboard.data?.toConfirm || lowStock) && (
                  <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] text-primary-foreground">
                    {(dashboard.data?.toConfirm ?? 0) + lowStock}
                  </span>
                )}
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-60 rounded-md border border-border bg-popover p-2 shadow-lg">
                <p className="px-2 py-2 text-sm font-semibold">Notifications</p>
                <Link
                  to="/seller/orders?status=TO_CONFIRM"
                  className="block rounded px-2 py-2 text-sm hover:bg-muted"
                >
                  Orders to confirm{" "}
                  <span className="float-right tabular-nums">
                    {dashboard.data?.toConfirm ?? 0}
                  </span>
                </Link>
                <Link
                  to="/seller/inventory?lowStock=true"
                  className="block rounded px-2 py-2 text-sm hover:bg-muted"
                >
                  Low stock variants{" "}
                  <span className="float-right tabular-nums">{lowStock}</span>
                </Link>
              </div>
            </details>
            <ThemeSwitch />
            <details className="relative">
              <summary
                aria-label="Seller account menu"
                className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full bg-muted font-semibold [&::-webkit-details-marker]:hidden"
              >
                {(user?.fullName || user?.phone || "S")
                  .slice(0, 1)
                  .toUpperCase()}
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-52 rounded-md border border-border bg-popover p-2 shadow-lg">
                <p className="border-b border-border px-2 py-2 text-sm font-medium">
                  {settings.data?.shopName || user?.fullName || "Seller"}
                </p>
                <Link
                  to="/seller/settings"
                  className="block min-h-11 rounded px-2 py-3 text-sm hover:bg-muted"
                >
                  Settings
                </Link>
                <Link
                  to="/seller/onboarding"
                  className="block min-h-11 rounded px-2 py-3 text-sm hover:bg-muted"
                >
                  Seller onboarding
                </Link>
                <button
                  className="flex min-h-11 w-full items-center gap-2 rounded px-2 py-3 text-left text-sm text-primary hover:bg-muted"
                  onClick={() =>
                    void signOut().finally(() =>
                      navigate("/seller/login", { replace: true }),
                    )
                  }
                >
                  <LogOut size={16} aria-hidden="true" /> Sign out
                </button>
              </div>
            </details>
          </div>
        </div>
      </header>
      <div className="md:flex">
        <nav
          aria-label="Seller navigation"
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-3 max-md:px-1 md:sticky md:top-16 md:h-[calc(100dvh-4rem)] md:w-16 md:flex-col md:self-start md:overflow-y-auto md:border-b-0 md:border-r xl:w-60"
        >
          {links.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              aria-label={label}
              className={({ isActive }) =>
                `flex min-h-11 shrink-0 items-center justify-center gap-3 rounded-md px-3 text-small focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:px-2 xl:justify-start xl:px-3 ${isActive ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`
              }
            >
              <Icon aria-hidden="true" size={18} />
              <span className="md:hidden xl:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
        <main id="seller-main" tabIndex={-1} className="min-w-0 flex-1">
          <Page width={pageWidth} className="py-5 md:py-8">
            <Outlet />
          </Page>
        </main>
      </div>
    </div>
  );
}
