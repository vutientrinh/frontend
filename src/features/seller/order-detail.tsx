import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/layout/Page";
import { ProductThumb } from "../../components/ProductThumb";
import { ErrorState, MoneyText, StatusBadge } from "../../components/shared";
import { TableSkeleton } from "../../components/TableSkeleton";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { OrderActivity } from "../storefront/components/OrderDetailParts";
import { OrderProgress } from "../storefront/components/OrderProgress";
import { useSellerOrder, useSellerOrderAction } from "../commerce/api";
import type { SellerOrderDetail } from "../commerce/types";
import { ErrorText, OrderDeadline } from "./common";
import { RejectOrderDialog } from "./RejectOrderDialog";

function MoneyLine({
  label,
  amount,
  sign,
  strong = false,
}: {
  label: string;
  amount: string;
  sign?: "minus";
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 py-2 text-sm ${strong ? "font-semibold" : ""}`}
    >
      <dt>{label}</dt>
      <dd>
        <MoneyText amount={amount} size="small" sign={sign} />
      </dd>
    </div>
  );
}

function Actions({ order }: { order: SellerOrderDetail }) {
  const action = useSellerOrderAction();
  const [rejecting, setRejecting] = useState(false);
  const { id, status } = order;
  const next =
    status === "PAID"
      ? ({ action: "confirm", label: "Confirm order" } as const)
      : status === "CONFIRMED"
        ? ({ action: "pack", label: "Mark packed" } as const)
        : status === "PACKED"
          ? ({ action: "handover", label: "Hand over to carrier" } as const)
          : null;
  return (
    <Card className="grid gap-3 p-5">
      <h2 className="font-semibold">Actions</h2>
      {status === "PAID" && (
        <p>
          <OrderDeadline createdAt={order.createdAt} />
        </p>
      )}
      {next ? (
        <Button
          className="min-h-11"
          disabled={action.isPending}
          onClick={() => action.mutate({ id, action: next.action })}
        >
          {next.label}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nothing to do on this order.
        </p>
      )}
      {status === "PAID" && (
        <Button
          variant="destructive"
          className="min-h-11"
          disabled={action.isPending}
          onClick={() => setRejecting(true)}
        >
          Reject order
        </Button>
      )}
      <ErrorText error={action.error} />
      <RejectOrderDialog
        order={rejecting ? order : undefined}
        onClose={() => setRejecting(false)}
        onReject={(orderId, reason) =>
          action.mutate({ id: orderId, action: "reject", reason })
        }
      />
    </Card>
  );
}

export function OrderDetail() {
  const { id = "" } = useParams();
  const q = useSellerOrder(id);
  const order = q.data;
  return (
    <>
      <PageHeader
        title={order ? `Order ${order.orderNumber}` : "Order detail"}
        breadcrumb={[
          { label: "Orders", to: "/seller/orders" },
          { label: order?.orderNumber ?? "Order" },
        ]}
        actions={order && <StatusBadge status={order.status} />}
      />
      {q.isError ? (
        <ErrorState retry={() => void q.refetch()} />
      ) : !order ? (
        <TableSkeleton rows={5} columns={3} label="Loading order" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            <Card className="p-5">
              <OrderProgress status={order.status} timeline={order.timeline} />
            </Card>
            <Card className="p-5">
              <h2 className="font-semibold">Order items</h2>
              <ul className="divide-y divide-border">
                {order.items.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 py-3">
                    <ProductThumb src={item.imageUrl} size={56} />
                    <div className="min-w-0 flex-1">
                      {/* Order lines carry no product id, so the link searches by name. */}
                      <Link
                        to={`/seller/products?q=${encodeURIComponent(item.name)}`}
                        className="flex min-h-11 items-center font-medium hover:underline"
                      >
                        <span className="line-clamp-2">{item.name}</span>
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {item.variantLabel && `${item.variantLabel} · `}Qty{" "}
                        {item.quantity}
                      </p>
                    </div>
                    <MoneyText amount={item.lineTotal} size="small" />
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-5">
              <h2 className="font-semibold">Delivery</h2>
              <p className="mt-2 text-sm">
                {order.shippingAddress.recipient} ·{" "}
                {order.shippingAddress.phone}
              </p>
              <p className="text-sm text-muted-foreground">
                {order.shippingAddress.address}
              </p>
            </Card>
            <Card className="p-5">
              <OrderActivity order={order} />
            </Card>
          </div>
          <aside className="space-y-5">
            <Actions order={order} />
            <Card className="p-5">
              <h2 className="mb-2 font-semibold">Money breakdown</h2>
              <dl className="divide-y divide-border">
                <MoneyLine label="Gross" amount={order.money.gross} />
                <MoneyLine label="Commission" amount={order.money.commission} />
                <MoneyLine
                  label="VAT on commission"
                  amount={order.money.vatOnCommission}
                />
                <MoneyLine label="Net" amount={order.money.net} strong />
                <MoneyLine label="Shipping" amount={order.shippingFee} />
                {order.discount !== "0" && (
                  <MoneyLine
                    label="Discount"
                    amount={order.discount}
                    sign="minus"
                  />
                )}
              </dl>
              <p className="mt-3 flex items-center gap-2 text-sm">
                Escrow <StatusBadge status={order.money.escrowStatus} />
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Buyer: {order.buyer.maskedName} · {order.buyer.maskedPhone}
              </p>
            </Card>
          </aside>
        </div>
      )}
    </>
  );
}
