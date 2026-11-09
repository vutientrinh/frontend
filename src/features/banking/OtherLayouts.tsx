import { NavLink, Outlet } from "react-router-dom";
export function SellerLayout() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Seller portal</h1>
      <p className="mt-3 text-muted-foreground">Coming in P2.</p>
      <Outlet />
    </main>
  );
}
export function BankLayout() {
  return (
    <div className="min-h-screen border-t-8 border-status-processing bg-muted/40">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-background px-5 py-4 md:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-status-processing">
            External systems
          </p>
          <h1 className="text-xl font-semibold">Bank simulator</h1>
        </div>
        <span className="rounded-full border border-status-processing px-3 py-1 text-sm font-medium text-status-processing">
          Simulator
        </span>
      </header>
      <div className="md:flex">
        <nav
          aria-label="Bank simulator navigation"
          className="flex gap-2 overflow-x-auto border-b border-border bg-background p-3 md:block md:w-56 md:shrink-0 md:space-y-1 md:border-b-0 md:border-r md:p-4"
        >
          {[
            ["/bank-sim", "Accounts"],
            ["/bank-sim/transfer", "Make a transfer"],
            ["/bank-sim/failures", "Failure settings"],
          ].map(([to, label]) => (
            <NavLink
              key={to}
              end={to === "/bank-sim"}
              to={to}
              className={({ isActive }) =>
                `block min-h-11 whitespace-nowrap rounded px-3 py-3 text-sm ${isActive ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:bg-muted"}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-1 p-5 pb-10 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
