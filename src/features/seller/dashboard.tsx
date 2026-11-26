import { Link } from "react-router-dom";
import { PageHeader } from "../../components/layout/Page";
import {
  EmptyState,
  ErrorState,
  MoneyText,
  RelativeTime,
  StatCard,
} from "../../components/shared";
import { TableSkeleton } from "../../components/TableSkeleton";
import { Button } from "../../components/ui/button";
import { useSellerDashboard } from "../commerce/api";
import type { SellerDashboard } from "../commerce/types";
import { Deadline } from "./common";
import { netText } from "./seller-utils";
import { LOW_STOCK_RULE, useLowStockCount } from "./seller-utils";

const grid = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4";

const hasNoSales = (d: SellerDashboard) =>
  !d.toConfirm &&
  !d.toPack &&
  !d.readyToShip &&
  d.revenue30d.gross === "0" &&
  d.pendingEscrow === "0";

export function Dashboard() {
  const q = useSellerDashboard();
  const lowStock = useLowStockCount();
  return (
    <>
      <PageHeader
        title="Seller dashboard"
        description="What needs your attention, then how the shop is doing."
      />
      {q.isError ? (
        <ErrorState retry={() => void q.refetch()} />
      ) : !q.data ? (
        <TableSkeleton rows={4} columns={4} label="Loading seller dashboard" />
      ) : (
        <div className="space-y-8">
          {hasNoSales(q.data) && (
            <EmptyState
              title="No sales yet"
              description="Add products and submit them for review to get your first order."
              illustration="empty-seller-products"
              action={
                <Button asChild variant="secondary">
                  <Link to="/seller/products/new">Add product</Link>
                </Button>
              }
            />
          )}
          <section aria-labelledby="needs-action">
            <h2 id="needs-action" className="mb-3 text-h3 font-semibold">
              Needs action
            </h2>
            <div className={grid}>
              <StatCard
                label="To confirm"
                value={q.data.toConfirm}
                to="/seller/orders?status=TO_CONFIRM"
              />
              <StatCard
                label="To pack"
                value={q.data.toPack}
                to="/seller/orders?status=TO_PACK"
              />
              <StatCard
                label="Ready to ship"
                value={q.data.readyToShip}
                to="/seller/orders?status=READY_TO_SHIP"
              />
              <StatCard
                label="Low stock"
                value={lowStock ?? "…"}
                detail={LOW_STOCK_RULE}
                to="/seller/inventory?lowStock=true"
              />
            </div>
          </section>
          <section aria-labelledby="sales-funds">
            <h2 id="sales-funds" className="mb-3 text-h3 font-semibold">
              Sales and funds
            </h2>
            <div className={grid}>
              <StatCard
                label="Revenue today"
                value={<MoneyText amount={q.data.revenueToday.gross} />}
                detail={netText(q.data.revenueToday.net)}
              />
              <StatCard
                label="Last 30 days"
                value={<MoneyText amount={q.data.revenue30d.gross} />}
                detail={netText(q.data.revenue30d.net)}
              />
              <StatCard
                label="Pending escrow"
                value={<MoneyText amount={q.data.pendingEscrow} />}
                detail="Released to you after delivery."
              />
              <StatCard
                label="Wallet"
                value={<MoneyText amount={q.data.walletBalance} />}
              />
            </div>
          </section>
          <section aria-labelledby="performance">
            <h2 id="performance" className="mb-3 text-h3 font-semibold">
              Shop performance
            </h2>
            <div className={grid}>
              <StatCard
                label="Cancellation rate"
                value={`${q.data.cancelRate}%`}
              />
              <StatCard
                label="Late shipment rate"
                value={`${q.data.lateShipRate}%`}
              />
            </div>
          </section>
          <section aria-labelledby="deadlines">
            <h2 id="deadlines" className="mb-3 text-h3 font-semibold">
              Confirmation deadlines
            </h2>
            {q.data.confirmDeadlines.length ? (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {q.data.confirmDeadlines.map((d) => (
                  <li key={d.orderId}>
                    <Link
                      to={`/seller/orders/${d.orderId}`}
                      className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted"
                    >
                      <span className="font-mono text-small text-primary">
                        {d.orderNumber}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Due <RelativeTime value={d.dueAt} />
                      </span>
                      <span className="ml-auto">
                        <Deadline dueAt={Date.parse(d.dueAt)} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No orders awaiting confirmation."
                illustration="empty-queue"
              />
            )}
          </section>
        </div>
      )}
    </>
  );
}
