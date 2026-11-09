import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { request } from "./client";
import type { Cart } from "../commerce/types";
import {
  CircleUserRound,
  WalletCards,
  Store,
  ShoppingCart,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "./AuthContext";
export default function ShopperShell() {
  const { user, signOut } = useAuth(),
    navigate = useNavigate(),
    { pathname } = useLocation();
  useEffect(() => {
    const title =
      pathname === "/"
        ? "Shop"
        : pathname === "/cart"
          ? "Cart"
          : pathname === "/checkout"
            ? "Checkout"
            : pathname === "/me/orders"
              ? "Orders"
              : pathname.startsWith("/me/orders/")
                ? "Order details"
                : pathname === "/me"
                  ? "Account"
                  : pathname.startsWith("/wallet")
                    ? "Wallet"
                    : pathname.startsWith("/p/")
                      ? "Product"
                      : pathname.startsWith("/shop/")
                        ? "Shop"
                        : pathname.startsWith("/c/")
                          ? "Category"
                          : "Payment Project";
    document.title = `${title} | Payment Project`;
  }, [pathname]);
  const cart = useQuery({
    queryKey: ["commerce", "cart"],
    queryFn: () => request<Cart>("/cart"),
    enabled: user?.roles.includes("SHOPPER") === true,
  });
  const cartCount =
    cart.data?.groups.reduce(
      (count, group) =>
        count + group.items.reduce((items, item) => items + item.quantity, 0),
      0,
    ) ?? 0;
  const [cartBump, setCartBump] = useState(false);
  const previousCartCount = useRef<number | null>(null);
  const bumpTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (cart.isPending) return;
    if (previousCartCount.current === null) {
      previousCartCount.current = cartCount;
      return;
    }

    const increased = cartCount > previousCartCount.current;
    previousCartCount.current = cartCount;
    if (bumpTimeout.current) clearTimeout(bumpTimeout.current);
    if (!increased) {
      setCartBump(false);
      return;
    }

    setCartBump(true);
    bumpTimeout.current = setTimeout(() => {
      setCartBump(false);
      bumpTimeout.current = null;
    }, 180);
  }, [cart.isPending, cartCount]);
  useEffect(
    () => () => {
      if (bumpTimeout.current) clearTimeout(bumpTimeout.current);
    },
    [],
  );
  const links = [
    { to: "/", label: "Shop", Icon: Store },
    { to: "/cart", label: "Cart", Icon: ShoppingCart },
    { to: "/me/orders", label: "Orders", Icon: ClipboardList },
    { to: "/wallet", label: "Wallet", Icon: WalletCards },
    { to: "/me", label: "Account", Icon: CircleUserRound },
  ];
  return (
    <div className="min-h-screen">
      <a href="#shop-main" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3 md:px-8">
        <Link to="/" className="font-semibold">
          <span className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded bg-primary text-sm text-primary-foreground">
              P
            </span>
            Payment Project
          </span>
        </Link>
        <details className="relative">
          <summary
            aria-label="Account menu"
            className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full bg-muted font-semibold text-foreground [&::-webkit-details-marker]:hidden"
          >
            {(user?.fullName || user?.phone || "U").slice(0, 1).toUpperCase()}
          </summary>
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-border bg-card p-2 shadow-lg">
            <p className="border-b border-border px-3 py-2 text-sm font-medium">
              {user?.fullName || user?.phone}
            </p>
            <Link
              to="/me"
              className="block min-h-11 rounded px-3 py-3 text-sm hover:bg-muted"
            >
              Account
            </Link>
            <button
              className="min-h-11 w-full rounded px-3 py-3 text-left text-sm text-primary hover:bg-muted"
              onClick={() => void signOut().finally(() => navigate("/login"))}
            >
              Sign out
            </button>
          </div>
        </details>
      </header>
      <div className="md:flex">
        <nav
          aria-label="Shopper navigation"
          className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-border bg-background px-2 pb-[env(safe-area-inset-bottom)] pt-2 md:static md:block md:min-h-[calc(100vh-4rem)] md:w-52 md:space-y-2 md:border-r md:border-t-0 md:p-4"
        >
          {links.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/" || to === "/me"}
              className={({ isActive }) =>
                `flex min-h-11 flex-col items-center justify-center gap-1 rounded px-2 py-1 text-xs sm:text-sm md:flex-row md:justify-start md:gap-3 md:px-3 ${isActive ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:bg-muted"}`
              }
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              {to === "/cart" && cartCount > 0 && (
                <span
                  className={`rounded-full bg-primary px-1.5 text-xs text-primary-foreground motion-safe:transition-transform motion-safe:duration-150 ${cartBump ? "motion-safe:scale-110" : ""}`}
                  aria-label={`${cartCount} items`}
                >
                  {cartCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <main
          id="shop-main"
          tabIndex={-1}
          className="w-full min-w-0 p-5 pb-24 md:p-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
