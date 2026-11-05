import { NavLink, Outlet } from "react-router-dom";
const links = [
  ["/", "Dashboard"],
  ["/customers", "Customers"],
  ["/products", "Products"],
  ["/orders", "Orders"],
  ["/payments", "Payments"],
  ["/events", "Event monitor"],
] as const;
export function AppShell() {
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-border bg-card p-6 md:min-h-screen md:w-60 md:border-r md:border-b-0">
        <div className="mb-6 text-lg font-semibold">Payment Project</div>
        <nav
          aria-label="Main navigation"
          className="flex flex-wrap gap-1 md:flex-col"
        >
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              end={to === "/"}
              to={to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm ${isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
