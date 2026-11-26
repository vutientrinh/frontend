import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  CircleUserRound,
  ClipboardList,
  Eye,
  EyeOff,
  LogIn,
  ShoppingCart,
  Store,
  UserPlus,
  WalletCards,
} from "lucide-react";
import { request } from "./client";
import type { Cart } from "../commerce/types";
import type { Wallet } from "./types";
import { useAuth } from "./AuthContext";
import { Page } from "../../components/layout/Page";
import { ThemeSwitch } from "../../components/layout/ThemeSwitch";
import { Money } from "../../components/shared";
import { SearchBar } from "../storefront/components/SearchBar";
import { Logo } from "@/components/brand/Logo";
import { brand, pageTitle } from "../../config/brand";
import { useBalanceVisibility } from "./useBalanceVisibility";
import { BellButton, BellLink, NotificationsPanel } from "./NotificationBell";
import { CategoryMenu } from "../storefront/components/category-menu/CategoryMenu";

const tabs = [
  { to: "/", label: "Home", Icon: Store },
  { to: "/me/orders", label: "Orders", Icon: ClipboardList },
  { to: "/wallet", label: "Wallet", Icon: WalletCards },
  { to: "/cart", label: "Cart", Icon: ShoppingCart },
  { to: "/me", label: "Me", Icon: CircleUserRound },
] as const;

function isHomeSection(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/search" ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/shop/")
  );
}

function isMeSection(pathname: string) {
  return pathname === "/me" || pathname.startsWith("/me/");
}

function tabIsActive(to: string, pathname: string) {
  if (to === "/") return isHomeSection(pathname);
  if (to === "/me") return isMeSection(pathname);
  return pathname === to || pathname.startsWith(`${to}/`);
}

function exactCurrent(to: string, pathname: string) {
  return pathname === to ? "page" : undefined;
}

export default function ShopperShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [visibleBalance, toggleBalance] = useBalanceVisibility();
  const routeKey = `${location.pathname}${location.search}`;
  // The popover belongs to the route it was opened on, so navigating closes it.
  const [popoverState, setPopoverState] = useState<{
    name: "account" | "bell";
    routeKey: string;
  } | null>(null);
  const openPopover =
    popoverState?.routeKey === routeKey ? popoverState.name : null;
  const setOpenPopover = useCallback(
    (name: "account" | "bell" | null) =>
      setPopoverState(name ? { name, routeKey } : null),
    [routeKey],
  );
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const mobileAccountTrigger = useRef<HTMLButtonElement>(null);
  const bellTrigger = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isShopper = user?.roles.includes("SHOPPER") === true;
  const hasSellerRole =
    user?.roles.some((role) => role.startsWith("SELLER_")) === true;
  const hasStaffRole =
    user?.roles.some((role) =>
      ["ADMIN", "FINANCE", "SUPPORT"].includes(role),
    ) === true;
  const isSellerOrStaff = !!user && !isShopper;
  const hideTabs =
    pathname.startsWith("/p/") ||
    pathname === "/checkout" ||
    pathname.startsWith("/pay/");

  useEffect(() => {
    const title =
      pathname === "/"
        ? "Shop"
        : pathname === "/cart"
          ? "Cart"
          : pathname === "/checkout"
            ? "Checkout"
            : pathname.startsWith("/me/orders")
              ? "Orders"
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
                        : brand.name;
    document.title = pageTitle(title);
  }, [pathname]);

  const cart = useQuery({
    queryKey: ["commerce", "cart"],
    queryFn: () => request<Cart>("/cart"),
    enabled: isShopper,
  });
  const wallet = useQuery({
    queryKey: ["wallet", "me"],
    queryFn: () => request<Wallet>("/wallets/me"),
    enabled: isShopper,
  });
  const cartCount =
    cart.data?.groups.reduce((count, group) => count + group.items.length, 0) ??
    0;
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
    }, 120);
  }, [cart.isPending, cartCount]);
  useEffect(
    () => () => {
      if (bumpTimeout.current) clearTimeout(bumpTimeout.current);
    },
    [],
  );

  useEffect(() => {
    if (!openPopover) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!popoverRef.current?.contains(event.target as Node))
        setOpenPopover(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpenPopover(null);
      (openPopover === "bell"
        ? bellTrigger
        : window.matchMedia("(max-width: 767px)").matches
          ? mobileAccountTrigger
          : accountTrigger
      ).current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openPopover, setOpenPopover]);

  function signOutAndReturn() {
    void signOut().finally(() => navigate("/", { replace: true }));
  }

  const showShopperUtilities = isShopper;
  const showTabs = !hideTabs;
  // Tab bar exists only below 768 px; the variable is 0 wherever it is hidden.
  const tabbarVar = showTabs
    ? "[--tabbar-h:56px] md:[--tabbar-h:0px]"
    : "[--tabbar-h:0px]";
  const mainWidth =
    pathname === "/me" || pathname === "/wallet"
      ? "content"
      : pathname === "/me/verify" || /\/(send|top-up)$/.test(pathname)
        ? "narrow"
        : "wide";

  return (
    <div className={`min-h-screen ${tabbarVar}`}>
      <a href="#shop-main" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <header className="border-b border-border bg-background md:sticky md:top-0 md:z-40">
        <Page
          width="wide"
          className="hidden min-h-16 items-center gap-3 py-2 md:flex"
        >
          <Link to="/" aria-label={`${brand.name}, home`} className="shrink-0">
            <Logo className="hidden min-[1024px]:inline-flex" />
            <Logo
              showWordmark={false}
              className="inline-flex min-[1024px]:hidden"
            />
          </Link>
          <CategoryMenu className="shrink-0" />
          <div className="min-w-0 flex-1 min-[768px]:min-w-[300px]">
            <SearchBar id="shopper-header-search" />
          </div>
          <nav
            aria-label="Your account"
            className="flex shrink-0 items-center gap-3"
          >
            {showShopperUtilities && (
              <Link
                to="/me/orders"
                aria-label="Orders"
                aria-current={exactCurrent("/me/orders", pathname)}
                className={`grid min-h-11 shrink-0 place-items-center rounded-md px-2 text-sm hover:bg-muted min-[1280px]:inline-flex min-[1280px]:gap-2 ${pathname.startsWith("/me/orders") ? "text-primary" : ""}`}
              >
                <ClipboardList
                  className="min-[1280px]:hidden"
                  size={19}
                  aria-hidden="true"
                />
                <span className="hidden min-[1280px]:inline">Orders</span>
              </Link>
            )}
            {showShopperUtilities && (
              <div className="hidden shrink-0 items-center gap-1 min-[1280px]:flex">
                <Link
                  to="/wallet"
                  aria-label="Wallet"
                  aria-current={exactCurrent("/wallet", pathname)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted ${pathname.startsWith("/wallet") ? "text-primary" : ""}`}
                >
                  <WalletCards size={18} aria-hidden="true" />
                  <span
                    aria-label={visibleBalance ? undefined : "Balance hidden"}
                  >
                    {wallet.data ? (
                      visibleBalance ? (
                        <Money
                          amount={wallet.data.availableBalance}
                          size="small"
                        />
                      ) : (
                        "••••••"
                      )
                    ) : wallet.isPending ? (
                      <span
                        aria-label="Loading balance"
                        className="inline-block h-4 w-16 animate-pulse rounded bg-muted"
                      />
                    ) : null}
                  </span>
                </Link>
                {wallet.data && (
                  <button
                    type="button"
                    aria-label={
                      visibleBalance ? "Hide balance" : "Show balance"
                    }
                    aria-pressed={visibleBalance}
                    onClick={() => toggleBalance(!visibleBalance)}
                    className="grid size-11 place-items-center rounded-md hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {visibleBalance ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                )}
              </div>
            )}
            {showShopperUtilities && (
              <BellButton
                ref={bellTrigger}
                expanded={openPopover === "bell"}
                active={pathname === "/notifications"}
                onClick={() =>
                  setOpenPopover(openPopover === "bell" ? null : "bell")
                }
              />
            )}
            {
              <Link
                to="/cart"
                aria-label={
                  cartCount
                    ? `Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`
                    : "Cart"
                }
                aria-current={exactCurrent("/cart", pathname)}
                className="relative grid size-11 shrink-0 place-items-center rounded-md hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <ShoppingCart size={19} aria-hidden="true" />
                {cartCount > 0 && (
                  <span
                    aria-hidden="true"
                    className={`absolute right-0 top-0 min-w-5 rounded-full bg-primary px-1 text-center text-xs text-primary-foreground motion-safe:transition-transform motion-safe:duration-150 ${cartBump ? "motion-safe:scale-110" : ""}`}
                  >
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </Link>
            }
            {user ? (
              <button
                ref={accountTrigger}
                type="button"
                aria-label={`Account menu, ${user.fullName || user.phone}`}
                aria-expanded={openPopover === "account"}
                aria-controls="shopper-account-popover"
                onClick={() =>
                  setOpenPopover(openPopover === "account" ? null : "account")
                }
                className={`grid size-11 shrink-0 place-items-center rounded-full bg-muted font-semibold hover:ring-2 hover:ring-primary focus-visible:outline-2 focus-visible:outline-ring ${isMeSection(pathname) ? "ring-2 ring-primary" : ""}`}
              >
                {(user.fullName || user.phone || "U").slice(0, 1).toUpperCase()}
              </button>
            ) : (
              <div className="hidden shrink-0 items-center gap-1 min-[768px]:flex">
                <Link
                  to="/login"
                  className="inline-flex min-h-11 items-center rounded-md px-2 text-sm hover:bg-muted"
                >
                  <LogIn size={16} className="mr-1" />
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="inline-flex min-h-11 items-center rounded-md border border-border px-2 text-sm hover:bg-muted"
                >
                  <UserPlus size={16} className="mr-1" />
                  Register
                </Link>
              </div>
            )}
            {!user && (
              <div className="hidden min-[768px]:block">
                <ThemeSwitch />
              </div>
            )}
          </nav>
        </Page>
        <div className="flex min-h-14 items-center gap-2 px-4 pb-2 md:hidden">
          <Link to="/" aria-label={`${brand.name}, home`} className="shrink-0">
            <Logo showWordmark={false} />
          </Link>
          {isShopper && <BellLink active={pathname === "/notifications"} />}
          {!user && (
            <div className="ml-auto flex items-center gap-1">
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center rounded px-2 text-sm hover:bg-muted"
              >
                Sign in
              </Link>
              <ThemeSwitch />
            </div>
          )}
          {isSellerOrStaff && (
            <button
              ref={mobileAccountTrigger}
              type="button"
              aria-label={`Account menu, ${user.fullName || user.phone}`}
              aria-expanded={openPopover === "account"}
              onClick={() =>
                setOpenPopover(openPopover === "account" ? null : "account")
              }
              className="ml-auto grid size-11 place-items-center rounded-full bg-muted font-semibold"
            >
              {(user.fullName || user.phone || "U").slice(0, 1).toUpperCase()}
            </button>
          )}
          {isSellerOrStaff && (
            <Link
              to="/cart"
              aria-label="Cart"
              className="grid size-11 place-items-center rounded-md"
            >
              <ShoppingCart />
            </Link>
          )}
        </div>
        <div className="sticky top-0 z-30 border-t border-border bg-background md:hidden">
          <Page width="wide" className="flex items-center gap-2 py-2">
            <CategoryMenu compact className="shrink-0" />
            <div className="min-w-0 flex-1">
              <SearchBar id="shopper-mobile-search" />
            </div>
          </Page>
        </div>
      </header>
      {openPopover && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          aria-hidden="true"
          onClick={() => setOpenPopover(null)}
        />
      )}
      {openPopover === "bell" && (
        <div
          ref={popoverRef}
          id="shopper-notifications-popover"
          className="fixed right-4 top-14 z-50 hidden w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover text-popover-foreground md:top-16 md:right-[max(24px,calc((100vw-1440px)/2+48px))] md:block"
        >
          <NotificationsPanel onClose={() => setOpenPopover(null)} />
        </div>
      )}
      {openPopover === "account" && user && (
        <div
          ref={popoverRef}
          id="shopper-account-popover"
          className="fixed right-4 top-14 z-50 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-2 text-popover-foreground md:top-16 md:right-[max(24px,calc((100vw-1440px)/2+48px))]"
        >
          <p className="border-b border-border px-3 py-3 text-sm font-semibold">
            {user.fullName || user.phone}
          </p>
          {isShopper && (
            <Link
              to="/me"
              className="block min-h-11 rounded px-3 py-3 text-sm hover:bg-muted"
            >
              My account
            </Link>
          )}
          {hasSellerRole && (
            <Link
              to="/seller"
              className="flex min-h-11 items-center gap-2 rounded px-3 py-3 text-sm hover:bg-muted"
            >
              <Store size={17} />
              Seller centre
            </Link>
          )}
          {hasStaffRole && (
            <Link
              to="/admin"
              className="flex min-h-11 items-center gap-2 rounded px-3 py-3 text-sm hover:bg-muted"
            >
              <BriefcaseBusiness size={17} />
              Back office
            </Link>
          )}
          <div className="border-t border-border px-1 pt-2">
            <ThemeSwitch variant="inline" />
          </div>
          {isShopper && (
            <div className="border-t border-border py-1 min-[1024px]:hidden">
              <Link
                to="/me/orders"
                className="block min-h-11 rounded px-3 py-3 text-sm hover:bg-muted"
              >
                Orders
              </Link>
              <Link
                to="/wallet"
                className="block min-h-11 rounded px-3 py-3 text-sm hover:bg-muted"
              >
                Wallet
              </Link>
            </div>
          )}
          {isShopper && (
            <div className="border-t border-border py-1">
              <Link
                to="/me/addresses"
                className="block min-h-11 rounded px-3 py-3 text-sm hover:bg-muted"
              >
                Addresses
              </Link>
              <Link
                to="/me/security"
                className="block min-h-11 rounded px-3 py-3 text-sm hover:bg-muted"
              >
                Security
              </Link>
            </div>
          )}
          <button
            type="button"
            onClick={signOutAndReturn}
            className="min-h-11 w-full rounded px-3 py-3 text-left text-sm text-primary hover:bg-muted"
          >
            Sign out
          </button>
        </div>
      )}
      <main
        id="shop-main"
        tabIndex={-1}
        className={
          hideTabs
            ? "w-full min-w-0"
            : "w-full min-w-0 pb-[calc(var(--tabbar-h,0px)+env(safe-area-inset-bottom))] md:pb-0"
        }
      >
        <div
          className={
            pathname === "/me" || pathname.startsWith("/wallet")
              ? "py-5 md:py-8"
              : ""
          }
        >
          {pathname === "/me" || pathname.startsWith("/wallet") ? (
            <Page width={mainWidth}>
              <Outlet />
            </Page>
          ) : (
            <Outlet />
          )}
        </div>
      </main>
      {showTabs && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <Page
            width="wide"
            className={`grid ${isSellerOrStaff ? "grid-cols-3" : "grid-cols-5"}`}
          >
            {tabs.map(({ to, label, Icon }) => {
              if (isSellerOrStaff && (to === "/me/orders" || to === "/wallet"))
                return null;
              const active = tabIsActive(to, pathname);
              return (
                <Link
                  key={to}
                  to={!user && to !== "/" ? "/login" : to}
                  state={
                    !user && to !== "/"
                      ? { from: `${to}${location.search}` }
                      : undefined
                  }
                  aria-current={exactCurrent(to, pathname)}
                  aria-label={
                    to === "/cart" && cartCount
                      ? `Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`
                      : undefined
                  }
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-xs focus-visible:outline-2 focus-visible:outline-ring ${active ? "font-semibold text-primary" : "text-muted-foreground"}`}
                >
                  <span className="relative">
                    <Icon size={19} aria-hidden="true" />
                    {to === "/cart" && cartCount > 0 && (
                      <span
                        aria-hidden="true"
                        className={`absolute -right-2 -top-2 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] text-primary-foreground motion-safe:transition-transform motion-safe:duration-150 ${cartBump ? "motion-safe:scale-110" : ""}`}
                      >
                        {cartCount > 99 ? "99+" : cartCount}
                      </span>
                    )}
                  </span>
                  <span>{label}</span>
                </Link>
              );
            })}
          </Page>
        </nav>
      )}
      <footer className="border-t border-border bg-background">
        <Page
          width="wide"
          className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-6 text-sm text-muted-foreground"
        >
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/help" className="hover:text-foreground">
              Help
            </Link>
            <Link
              to="/legal/buyer-protection"
              className="hover:text-foreground"
            >
              Buyer protection
            </Link>
            <Link to="/legal/returns" className="hover:text-foreground">
              Returns & refunds
            </Link>
            <Link to="/legal/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link to="/legal/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/seller/login" className="hover:text-foreground">
              Sell on Jadeway
            </Link>
          </nav>
          <span>
            © {new Date().getFullYear()} {brand.name}
          </span>
        </Page>
      </footer>
    </div>
  );
}
