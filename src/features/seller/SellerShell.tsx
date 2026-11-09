import { Link, NavLink, Outlet } from "react-router-dom";
import {
  Box,
  ClipboardList,
  LayoutDashboard,
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
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#seller-main" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 font-semibold">
        <div>
          Payment Project{" "}
          <span className="font-normal text-muted-foreground">/ Seller</span>
        </div>
        <Link
          className="rounded-md px-3 py-2 text-small text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          to="/seller/onboarding"
        >
          Seller onboarding
        </Link>
      </header>
      <div className="md:flex">
        <nav
          aria-label="Seller navigation"
          className="flex gap-1 overflow-x-auto border-b border-border p-3 md:min-h-screen md:w-60 md:flex-col md:border-b-0 md:border-r"
        >
          {links.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-11 shrink-0 items-center gap-3 rounded-md px-3 text-small focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${isActive ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`
              }
            >
              <Icon aria-hidden="true" size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <main
          id="seller-main"
          tabIndex={-1}
          className="min-w-0 flex-1 p-5 md:p-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
