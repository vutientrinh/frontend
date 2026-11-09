import { Fragment, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  CreditCard,
  Activity,
  Menu,
  PanelLeftClose,
  Search,
  Settings,
  LogOut,
  UserRound,
  SunMoon,
  WalletCards,
  ArrowLeftRight,
  BookOpenCheck,
  ScrollText,
} from "lucide-react";
import { api } from "../api/client";
import { Command } from "cmdk";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import { applyTheme, getTheme, type Theme } from "./theme";
import { useAuth } from "../features/banking/AuthContext";
import { adminMarketplaceNav } from "../features/admin-marketplace/routes";
const breadcrumbLabels: Record<string, string> = {
  customers: "Customers",
  products: "Products",
  orders: "Orders",
  payments: "Payments",
  events: "Event monitor",
  settings: "Settings",
  profile: "Profile",
  new: "New",
  wallets: "Wallets",
  transfers: "Top-ups & transfers",
  ledger: "Ledger explorer",
  journals: "Journal detail",
  audit: "Audit log",
  marketplace: "Marketplace",
  sellers: "Sellers",
  categories: "Categories",
  moderation: "Moderation",
  "marketplace-orders": "Marketplace orders",
};
const workspaceLinks = [
  ["/admin", "Dashboard", LayoutDashboard],
  ["/admin/customers", "Customers", Users],
  ["/admin/products", "Products", Package],
  ["/admin/orders", "Orders", ShoppingCart],
  ["/admin/payments", "Payments", CreditCard],
  ["/admin/events", "Event monitor", Activity],
] as const;
const bankingLinks = [
  ["/admin/wallets", "Wallets", WalletCards],
  ["/admin/transfers", "Top-ups & transfers", ArrowLeftRight],
  ["/admin/ledger", "Ledger explorer", BookOpenCheck],
  ["/admin/audit", "Audit log", ScrollText],
  ["/admin/settings", "Limits & settings", Settings],
] as const;
const marketplaceLinks = adminMarketplaceNav.map(
  ({ to, label, icon }) => [to, label, icon] as const,
);
const links = [...workspaceLinks, ...marketplaceLinks, ...bankingLinks];
export function AppShell() {
  const auth = useAuth();
  const [collapsed, setCollapsed] = useState(false),
    [drawer, setDrawer] = useState(false),
    [search, setSearch] = useState(false),
    [q, setQ] = useState(""),
    [results, setResults] = useState<{ label: string; to: string }[]>([]),
    [theme, setTheme] = useState<Theme>(getTheme),
    [user, setUser] = useState(() => auth.user?.fullName || "Staff");
  const navigate = useNavigate(),
    location = useLocation();
  useEffect(() => {
    const refresh = () => setUser(auth.user?.fullName || "Staff");
    window.addEventListener("payment-user-change", refresh);
    return () => window.removeEventListener("payment-user-change", refresh);
  }, [auth.user]);
  useEffect(() => {
    const refresh = () => setTheme(getTheme());
    window.addEventListener("payment-theme-change", refresh);
    return () => window.removeEventListener("payment-theme-change", refresh);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!search || !q.trim()) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const [c, o, p] = await Promise.all([
          api.GET("/customers", { params: { query: { q, size: 5 } } }),
          api.GET("/orders", { params: { query: { q, size: 5 } } }),
          api.GET("/payments", { params: { query: { size: 100 } } }),
        ]);
        if (active)
          setResults([
            ...(c.data?.content ?? []).map((x) => ({
              label: `Customer: ${x.firstName} ${x.lastName}`,
              to: `/admin/customers/${x.id}`,
            })),
            ...(o.data?.content ?? []).map((x) => ({
              label: `Order: ${x.orderCode}`,
              to: `/admin/orders/${x.id}`,
            })),
            ...(p.data?.content ?? [])
              .filter((x) => x.id.toLowerCase().includes(q.toLowerCase()))
              .slice(0, 5)
              .map((x) => ({
                label: `Payment: ${x.id}`,
                to: `/admin/payments/${x.id}`,
              })),
          ]);
      } catch {
        if (active) setResults([]);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q, search]);
  const go = (to: string) => {
    setSearch(false);
    setDrawer(false);
    setQ("");
    navigate(to);
  };
  const nav = (
    <nav aria-label="Main navigation" className="space-y-1">
      {links.map(([to, label, Icon], index) => (
        <Fragment key={to}>
          {index === workspaceLinks.length && (
            <p className="mb-2 mt-6 border-t border-border pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Marketplace
            </p>
          )}
          {index === workspaceLinks.length + marketplaceLinks.length && (
            <p className="mb-2 mt-6 border-t border-border pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Banking
            </p>
          )}
          <NavLink
            onClick={() => setDrawer(false)}
            end={to === "/admin"}
            to={to}
            title={label}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm ${isActive ? "bg-muted text-foreground font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`
            }
          >
            <Icon size={18} aria-hidden="true" />
            <span className={collapsed ? "md:hidden" : "md:hidden lg:inline"}>
              {label}
            </span>
          </NavLink>
        </Fragment>
      ))}
    </nav>
  );
  return (
    <div className="min-h-screen md:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-3"
      >
        Skip to content
      </a>
      <aside
        className={`hidden shrink-0 border-r border-border bg-background p-4 md:block ${collapsed ? "md:w-16 lg:w-16" : "md:w-16 lg:w-60"}`}
      >
        <div className="mb-6 flex items-center justify-between">
          <span
            className={`font-semibold ${collapsed ? "md:hidden" : "md:hidden lg:inline"}`}
          >
            Payment Project
          </span>
          <button
            aria-label="Toggle sidebar"
            className="rounded p-2 hover:bg-muted"
            onClick={() => setCollapsed(!collapsed)}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        {nav}
      </aside>
      <Dialog open={drawer} onOpenChange={setDrawer}>
        <DialogContent className="left-0 top-0 h-full w-64 translate-x-0 translate-y-0 rounded-none">
          <DialogTitle className="mb-6">Payment Project</DialogTitle>
          {nav}
        </DialogContent>
      </Dialog>
      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center gap-3 border-b border-border bg-background px-4 md:px-8">
          <button
            className="rounded p-2 md:hidden"
            aria-label="Open navigation"
            onClick={() => setDrawer(true)}
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            Workspace /{" "}
            {location.pathname === "/admin"
              ? "Dashboard"
              : location.pathname
                  .split("/")
                  .filter((part) => part && part !== "admin")
                  .map((part, index, parts) =>
                    /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(part)
                      ? parts[index - 1] === "wallets"
                        ? "Wallet detail"
                        : parts[index - 1] === "journals"
                          ? "Journal detail"
                          : "Record detail"
                      : (breadcrumbLabels[part] ?? part),
                  )
                  .join(" / ")}
          </div>
          <button
            onClick={() => setSearch(true)}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
            aria-label="Search (Control or Command K)"
          >
            <Search size={16} />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden text-xs sm:inline">âŒ˜K</kbd>
          </button>
          <label className="sr-only" htmlFor="theme">
            Theme
          </label>
          <SunMoon size={17} />
          <select
            id="theme"
            value={theme}
            onChange={(e) => {
              const value = e.target.value as Theme;
              setTheme(value);
              applyTheme(value);
            }}
            className="max-w-20 bg-transparent text-sm"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <details className="relative shrink-0">
            <summary
              className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full bg-primary text-xs font-semibold uppercase text-primary-foreground [&::-webkit-details-marker]:hidden"
              aria-label="User menu"
            >
              {user.slice(0, 2)}
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-44 rounded-md border border-border bg-card p-1 shadow-lg">
              <button
                onClick={() => navigate("/admin/profile")}
                className="flex w-full gap-2 rounded p-2 text-sm hover:bg-muted"
              >
                <UserRound size={16} />
                Profile
              </button>
              <button
                onClick={() => navigate("/admin/settings")}
                className="flex w-full gap-2 rounded p-2 text-sm hover:bg-muted"
              >
                <Settings size={16} />
                Settings
              </button>
              <button
                onClick={() => {
                  void auth
                    .signOut()
                    .finally(() => navigate("/admin/login", { replace: true }));
                }}
                className="flex w-full gap-2 rounded p-2 text-sm hover:bg-muted"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </details>
        </header>
        <main id="main-content" tabIndex={-1} className="w-full p-6 md:p-8">
          <Outlet />
        </main>
      </div>
      <Dialog open={search} onOpenChange={setSearch}>
        <DialogContent>
          <DialogTitle>Search and actions</DialogTitle>
          <Command shouldFilter={false} label="Search and actions">
            <Command.Input
              autoFocus
              value={q}
              onValueChange={(value) => {
                setQ(value);
                setResults([]);
              }}
              placeholder="Search pages or records"
              aria-label="Search pages or records"
              className="my-4 w-full rounded border border-border bg-background p-2"
            />
            <Command.List className="max-h-80 overflow-auto text-sm">
              <Command.Group heading="Pages" className="text-muted-foreground">
                {links
                  .filter(
                    ([, label]) =>
                      !q || label.toLowerCase().includes(q.toLowerCase()),
                  )
                  .map(([to, label, Icon]) => (
                    <Command.Item
                      key={to}
                      value={label}
                      onSelect={() => go(to)}
                      className="flex cursor-pointer items-center gap-3 rounded px-3 py-2 text-foreground data-[selected=true]:bg-muted"
                    >
                      <Icon size={16} />
                      {label}
                    </Command.Item>
                  ))}
              </Command.Group>
              {q.trim() && (
                <Command.Group
                  heading="Records"
                  className="text-muted-foreground"
                >
                  {results.map((x) => (
                    <Command.Item
                      key={x.to}
                      value={x.to}
                      onSelect={() => go(x.to)}
                      className="flex cursor-pointer items-center gap-3 rounded px-3 py-2 text-foreground data-[selected=true]:bg-muted"
                    >
                      <Search size={16} />
                      {x.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              <Command.Group
                heading="Actions"
                className="text-muted-foreground"
              >
                {[
                  { to: "/admin/orders/new", label: "New order" },
                  { to: "/admin/payments/new", label: "New payment" },
                ]
                  .filter(
                    (x) =>
                      !q || x.label.toLowerCase().includes(q.toLowerCase()),
                  )
                  .map((x) => (
                    <Command.Item
                      key={x.to}
                      value={x.label}
                      onSelect={() => go(x.to)}
                      className="flex cursor-pointer items-center gap-3 rounded px-3 py-2 text-foreground data-[selected=true]:bg-muted"
                    >
                      <span>ï¼‹</span>
                      {x.label}
                      <span className="ml-auto text-xs text-muted-foreground">
                        Enter â†µ
                      </span>
                    </Command.Item>
                  ))}
                <Command.Item
                  value="Toggle theme"
                  onSelect={() => {
                    const next = theme === "dark" ? "light" : "dark";
                    setTheme(next);
                    applyTheme(next);
                    setSearch(false);
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded px-3 py-2 text-foreground data-[selected=true]:bg-muted"
                >
                  <SunMoon size={16} />
                  Toggle theme
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}
