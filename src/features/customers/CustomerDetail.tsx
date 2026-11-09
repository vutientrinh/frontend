import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CreditCard, ShoppingBag, UserRound } from "lucide-react";
import { api } from "../../api/client";
import {
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
  StatusBadge,
} from "../../components/shared";
import type { Order, Payment } from "../../api/types";
export default function CustomerDetail() {
  const { id = "" } = useParams();
  useEffect(() => {
    document.title = "Customer detail | Payment Project";
  }, []);
  const customer = useQuery({
    queryKey: ["customers", id],
    queryFn: async () => {
      const r = await api.GET("/customers/{id}", { params: { path: { id } } });
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const activity = useQuery({
    queryKey: ["customer-activity", id],
    queryFn: async () => {
      const orders: Order[] = [];
      let page = 0,
        total = 1;
      while (page < total) {
        const r = await api.GET("/orders", {
          params: { query: { customerId: id, page, size: 100 } },
        });
        if (r.error) throw r.error;
        orders.push(...r.data.content);
        total = r.data.totalPages;
        page++;
      }
      const payments: Payment[] = [];
      page = 0;
      total = 1;
      while (page < total) {
        const r = await api.GET("/payments", {
          params: { query: { page, size: 100 } },
        });
        if (r.error) throw r.error;
        payments.push(...r.data.content);
        total = r.data.totalPages;
        page++;
      }
      const ids = new Set(orders.map((o) => o.id));
      return { orders, payments: payments.filter((p) => ids.has(p.orderId)) };
    },
  });
  if (customer.isLoading)
    return (
      <p role="status" className="p-6 text-muted-foreground">
        Loading customer…
      </p>
    );
  if (customer.isError || !customer.data)
    return (
      <ErrorState
        message="Unable to load this customer."
        retry={() => void customer.refetch()}
      />
    );
  const c = customer.data;
  return (
    <>
      <Link
        to="/admin/customers"
        className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={16} />
        Customers
      </Link>
      <PageHeader
        title={`${c.firstName} ${c.lastName}`}
        description="Customer profile and activity"
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="h-fit border-t border-border bg-background p-6 lg:col-span-2">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-muted p-4 text-primary">
              <UserRound size={24} />
            </div>
            <div>
              <h2 className="font-semibold">
                {c.firstName} {c.lastName}
              </h2>
              <p className="text-sm text-muted-foreground">Customer</p>
            </div>
          </div>
          <dl className="mt-6 space-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-1 break-all font-medium">{c.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="mt-1 font-medium">{c.phoneNumber}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Customer ID</dt>
              <dd className="mt-1 break-all">{c.id}</dd>
            </div>
          </dl>
        </section>
        <div className="space-y-6">
          {activity.isLoading ? (
            <div role="status" className="rounded-xl bg-muted p-8">
              Loading activity…
            </div>
          ) : activity.isError ? (
            <ErrorState
              message="Unable to load customer activity."
              retry={() => void activity.refetch()}
            />
          ) : (
            <>
              {[
                {
                  title: "Orders",
                  icon: ShoppingBag,
                  records: activity.data?.orders ?? [],
                },
                {
                  title: "Payments",
                  icon: CreditCard,
                  records: activity.data?.payments ?? [],
                },
              ].map(({ title, icon: Icon, records }) => (
                <section
                  key={title}
                  className="border-t border-border bg-background p-6"
                >
                  <div className="mb-4 flex items-center gap-2">
                    <Icon size={18} className="text-primary" />
                    <h2 className="font-semibold">{title}</h2>
                    <span className="ml-auto text-sm text-muted-foreground">
                      {records.length}
                    </span>
                  </div>
                  {records.length === 0 ? (
                    <EmptyState
                      title={`No ${title.toLowerCase()} yet`}
                      description="Activity will appear here when available."
                    />
                  ) : (
                    <ul className="divide-y divide-border">
                      {records.map((r) => (
                        <li key={r.id}>
                          <Link
                            to={
                              title === "Orders"
                                ? `/admin/orders/${r.id}`
                                : `/admin/payments/${r.id}`
                            }
                            className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm hover:text-primary"
                          >
                            <span className="font-medium">
                              {"orderCode" in r
                                ? r.orderCode
                                : r.id.slice(0, 12)}
                            </span>
                            <StatusBadge status={r.status} />
                            <span className="font-medium tabular-nums">
                              <Money
                                amount={
                                  "orderAmount" in r ? r.orderAmount : r.amount
                                }
                              />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
