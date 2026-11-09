import {
  createElement,
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentType,
} from "react";
import {
  QueryClient,
  QueryClientProvider,
  MutationCache,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  Link,
  Navigate,
  Route,
  Routes,
  Outlet,
  useLocation,
  useNavigationType,
  useNavigate,
  type RouteObject,
} from "react-router-dom";
import { toast, Toaster } from "sonner";

import { ErrorBoundary } from "./ErrorBoundary";
import { applyTheme, getTheme } from "./theme";
import { AuthProvider, useAuth } from "../features/banking/AuthContext";
import {
  storefrontPublicRoutes,
  storefrontShopperRoutes,
} from "../features/storefront/routes";
import { sellerRoutes } from "../features/seller";
import { adminMarketplaceRoutes } from "../features/admin-marketplace/routes";
const AppShell = lazy(() =>
  import("./AppShell").then((m) => ({ default: m.AppShell })),
);
const BankLayout = lazy(() =>
  import("../features/banking/OtherLayouts").then((m) => ({
    default: m.BankLayout,
  })),
);
const AuthPage = lazy(() => import("../features/banking/AuthPage"));
const ShopperShell = lazy(() => import("../features/banking/ShopperShell"));
const Account = lazy(() => import("../features/banking/Account"));
const WalletHome = lazy(() =>
  import("../features/banking/Wallet").then((m) => ({ default: m.WalletHome })),
);
const TopUpForm = lazy(() =>
  import("../features/banking/Wallet").then((m) => ({ default: m.TopUpForm })),
);
const TopUpStatus = lazy(() =>
  import("../features/banking/Wallet").then((m) => ({
    default: m.TopUpStatus,
  })),
);
const Send = lazy(() =>
  import("../features/banking/Wallet").then((m) => ({ default: m.Send })),
);
const Statement = lazy(() =>
  import("../features/banking/Wallet").then((m) => ({ default: m.Statement })),
);
const TransactionDetail = lazy(() =>
  import("../features/banking/Wallet").then((m) => ({
    default: m.TransactionDetail,
  })),
);
const Receipt = lazy(() =>
  import("../features/banking/Wallet").then((m) => ({ default: m.Receipt })),
);
const MyQr = lazy(() =>
  import("../features/banking/Wallet").then((m) => ({ default: m.MyQr })),
);
const BankConsole = lazy(() => import("../features/banking/BankConsole"));
const AdminBanking = lazy(() => import("../features/banking/AdminBanking"));
const Page = lazy(() => import("./Page"));
const DemoSettings = lazy(() => import("./DemoSettings"));
const CatalogPage = lazy(() => import("../features/catalog/CatalogPage"));
const CustomerDetail = lazy(
  () => import("../features/customers/CustomerDetail"),
);
const TransactionList = lazy(
  () => import("../features/transactions/TransactionList"),
);
const OrderForm = lazy(() => import("../features/orders/OrderForm"));
const OrderDetail = lazy(() => import("../features/orders/OrderDetail"));
const PaymentForm = lazy(() => import("../features/payments/PaymentForm"));
const PaymentDetail = lazy(() => import("../features/payments/PaymentDetail"));
const Dashboard = lazy(() => import("../features/dashboard/Dashboard"));
const EventMonitor = lazy(() => import("../features/events/EventMonitor"));
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      if (!mutation.meta?.suppressSuccessToast) toast.success("Changes saved");
    },
    onError: () => toast.error("Could not save changes"),
  }),
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});
function AccessDenied() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const hasStaffAccess = user?.roles.some((role) =>
    ["ADMIN", "FINANCE", "SUPPORT"].includes(role),
  );
  const destination = hasStaffAccess ? "/admin" : "/wallet";
  const area = hasStaffAccess ? "admin workspace" : "wallet";
  return (
    <main className="mx-auto max-w-xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Access denied</h1>
      <p className="text-muted-foreground">
        Signed in as {user?.fullName ?? user?.phone ?? "Unknown user"}.
      </p>
      <p>This account does not have access to this area.</p>
      <div className="flex flex-wrap gap-3">
        <Link
          className="inline-flex min-h-11 items-center rounded bg-primary px-4 text-primary-foreground"
          to={destination}
        >
          Go to your {area}
        </Link>
        <button
          className="min-h-11 rounded border border-border px-4"
          onClick={() =>
            void signOut().finally(() => navigate("/login", { replace: true }))
          }
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
function Guard({ staff = false }: { staff?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status">Restoring session…</p>;
  if (!user)
    return (
      <Navigate
        to={staff ? "/admin/login" : "/login"}
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  const permitted = staff
    ? user.roles.some((r) => ["ADMIN", "FINANCE", "SUPPORT"].includes(r))
    : user.roles.includes("SHOPPER");
  return permitted ? staff ? <AppShell /> : <ShopperShell /> : <AccessDenied />;
}
function ShopperOnly() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status">Restoring session…</p>;
  return user?.roles.includes("SHOPPER") ? (
    <Outlet />
  ) : user ? (
    <AccessDenied />
  ) : (
    <Navigate
      to="/login"
      replace
      state={{ from: location.pathname + location.search }}
    />
  );
}
function SellerGuard({ children }: { children: import("react").ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status">Restoring session…</p>;
  if (!user)
    return (
      <Navigate
        to="/seller/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  return user.roles.includes("SELLER_OWNER") ||
    user.roles.includes("SELLER_STAFF") ? (
    <>{children}</>
  ) : (
    <AccessDenied />
  );
}
const routePages = new WeakMap<RouteObject, ComponentType>();
function registerRoutePages(routes: RouteObject[]) {
  for (const route of routes) {
    const load = route.lazy as
      (() => Promise<{ Component?: ComponentType }>) | undefined;
    if (load) {
      routePages.set(
        route,
        lazy(async () => {
          const loaded = await load();
          if (!loaded.Component)
            throw new Error("Route export has no page component.");
          return { default: loaded.Component };
        }),
      );
    }
    const children = (route as RouteObject & { children?: RouteObject[] })
      .children;
    if (children) registerRoutePages(children);
  }
}
registerRoutePages([
  ...storefrontPublicRoutes,
  ...storefrontShopperRoutes,
  ...sellerRoutes,
  ...adminMarketplaceRoutes,
]);

function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const currentKey = useRef(location.key);
  const positions = useRef(new Map<string, number>());

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const savePosition = () =>
      positions.current.set(currentKey.current, window.scrollY);
    window.addEventListener("scroll", savePosition, { passive: true });
    return () => {
      window.removeEventListener("scroll", savePosition);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    positions.current.set(currentKey.current, window.scrollY);
    currentKey.current = location.key;
    const top =
      navigationType === "POP" ? (positions.current.get(location.key) ?? 0) : 0;
    const frame = window.requestAnimationFrame(() => {
      const scrollingElement = document.scrollingElement;
      if (scrollingElement) scrollingElement.scrollTop = top;
      else window.scrollTo(0, top);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.key, navigationType]);

  return null;
}

function RoutePage({ route }: { route: RouteObject }) {
  const Component = routePages.get(route);
  return Component ? createElement(Component) : null;
}
function mountRoute(
  route: RouteObject,
  keyPrefix = "route",
  protectSeller = false,
) {
  const key = `${keyPrefix}-${String(route.path ?? (route.index ? "index" : "route"))}`;
  const isSellerRoot = protectSeller && keyPrefix === "seller-root";
  const children = (route as RouteObject & { children?: RouteObject[] })
    .children;
  const childPrefix = isSellerRoot ? "seller-child" : keyPrefix;
  const element = route.element ?? <RoutePage route={route} />;
  if (route.index) return <Route key={key} index element={element} />;
  return (
    <Route
      key={key}
      path={isSellerRoot ? "/seller" : route.path}
      element={isSellerRoot ? <SellerGuard>{element}</SellerGuard> : element}
    >
      {children?.map((child) => mountRoute(child, childPrefix))}
    </Route>
  );
}
function LegacyRedirect() {
  const location = useLocation();
  return (
    <Navigate replace to={`/admin${location.pathname}${location.search}`} />
  );
}
function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-muted-foreground">Coming in P2.</p>
    </div>
  );
}
function GuardAny() {
  const { user, loading } = useAuth();
  if (loading) return <p role="status">Restoring session…</p>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
export function App() {
  useEffect(() => {
    document.documentElement.dataset.density =
      localStorage.getItem("payment-density") ?? "comfortable";
    const media = matchMedia("(prefers-color-scheme: dark)"),
      update = () => applyTheme(getTheme());
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorBoundary>
          <ScrollManager />
          <Suspense
            fallback={
              <p role="status" className="p-8">
                Loading…
              </p>
            }
          >
            <Routes>
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/register" element={<AuthPage mode="register" />} />
              <Route path="/verify-otp" element={<AuthPage mode="verify" />} />
              <Route
                path="/forgot-password"
                element={<AuthPage mode="forgot" />}
              />
              <Route
                path="/admin/login"
                element={<AuthPage mode="login" staff />}
              />{" "}
              <Route
                path="/admin/verify"
                element={<AuthPage mode="verify" staff />}
              />
              <Route
                path="/seller/login"
                element={<AuthPage mode="login" seller />}
              />
              <Route
                path="/seller/verify"
                element={<AuthPage mode="verify" seller />}
              />
              <Route path="/" element={<ShopperShell />}>
                {storefrontPublicRoutes.map((route) =>
                  mountRoute(route, "storefront-public"),
                )}

                <Route element={<ShopperOnly />}>
                  {storefrontShopperRoutes.map((route) =>
                    mountRoute(route, "storefront-shopper"),
                  )}

                  <Route path="me" element={<Account />} />
                  <Route path="me/verify" element={<Account verify />} />
                </Route>
              </Route>
              <Route element={<Guard />}>
                <Route path="wallet" element={<WalletHome />} />
                <Route path="wallet/top-up" element={<TopUpForm />} />
                <Route path="wallet/top-up/:id" element={<TopUpStatus />} />
                <Route path="wallet/send" element={<Send />} />
                <Route path="wallet/statement" element={<Statement />} />
                <Route path="wallet/tx/:id" element={<TransactionDetail />} />
                <Route path="wallet/receipt/:id" element={<Receipt />} />
                <Route path="wallet/qr" element={<MyQr />} />
                <Route path="me" element={<Account />} />
                <Route path="me/verify" element={<Account verify />} />
                <Route
                  path="notifications"
                  element={<Placeholder title="Notifications" />}
                />
              </Route>
              <Route path="/admin" element={<Guard staff />}>
                <Route index element={<Dashboard />} />
                <Route path="settings" element={<DemoSettings />} />
                <Route
                  path="wallets"
                  element={<AdminBanking page="wallets" />}
                />
                <Route
                  path="wallets/:id"
                  element={<AdminBanking page="wallet-detail" />}
                />
                <Route
                  path="transfers"
                  element={<AdminBanking page="operations" />}
                />
                <Route path="ledger" element={<AdminBanking page="ledger" />} />
                <Route
                  path="ledger/journals/:id"
                  element={<AdminBanking page="journal-detail" />}
                />
                <Route path="audit" element={<AdminBanking page="audit" />} />
                <Route
                  path="profile"
                  element={<Navigate to="/admin/settings" replace />}
                />
                <Route
                  path="customers"
                  element={<CatalogPage kind="customers" />}
                />
                <Route path="customers/:id" element={<CustomerDetail />} />
                <Route
                  path="products"
                  element={<CatalogPage kind="products" />}
                />
                <Route path="events" element={<EventMonitor />} />
                <Route
                  path="orders"
                  element={<TransactionList kind="orders" />}
                />
                <Route path="orders/new" element={<OrderForm />} />
                <Route path="orders/:id" element={<OrderDetail />} />
                <Route
                  path="payments"
                  element={<TransactionList kind="payments" />}
                />
                <Route path="payments/new" element={<PaymentForm />} />
                <Route path="payments/:id" element={<PaymentDetail />} />
                {adminMarketplaceRoutes.map((route) =>
                  mountRoute(route, "admin-marketplace"),
                )}

                <Route path="*" element={<Page title="Page not found" />} />
              </Route>
              {[
                "customers",
                "products",
                "orders",
                "payments",
                "events",
                "settings",
                "profile",
              ].map((p) => (
                <Route key={p} path={`/${p}/*`} element={<LegacyRedirect />} />
              ))}
              {sellerRoutes.map((route) =>
                mountRoute(route, "seller-root", true),
              )}
              <Route element={<GuardAny />}>
                <Route path="/bank-sim" element={<BankLayout />}>
                  <Route index element={<BankConsole page="accounts" />} />
                  <Route
                    path="transfer"
                    element={<BankConsole page="transfer" />}
                  />
                  <Route
                    path="failures"
                    element={<BankConsole page="failures" />}
                  />
                  <Route path="*" element={<BankConsole page="accounts" />} />
                </Route>
              </Route>
              <Route path="*" element={<Page title="Page not found" />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
        <Toaster />
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </AuthProvider>
    </QueryClientProvider>
  );
}
