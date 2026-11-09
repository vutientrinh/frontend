import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../banking/client";
import {
  ErrorState,
  KeyValueList,
  Money,
  PageHeader,
  RelativeTime,
  StatusBadge,
} from "../../../components/shared";
import { humanLabel } from "../../../lib/labels";
import { useAdminCustomer } from "../api";
import { NotFound, OrderRowsTable, Section } from "../components";

/** A-03 Customer 360: profile, addresses, wallet, recent transactions and orders. */
export default function CustomerDetailPage() {
  const { id = "" } = useParams();
  const customer = useAdminCustomer(id);
  if (customer.isError)
    return customer.error instanceof ApiError &&
      customer.error.status === 404 ? (
      <NotFound what="Customer" back="/admin/marketplace/customers" />
    ) : (
      <ErrorState retry={() => void customer.refetch()} />
    );
  if (customer.isLoading || !customer.data)
    return (
      <div role="status" className="space-y-3">
        <span className="sr-only">Loading customer</span>
        <div className="h-8 w-1/3 rounded bg-muted motion-safe:animate-pulse" />
        <div className="h-40 rounded bg-muted motion-safe:animate-pulse" />
      </div>
    );
  const c = customer.data;
  return (
    <>
      <Link
        to="/admin/marketplace/customers"
        className="text-sm text-primary hover:underline"
      >
        Customers
      </Link>
      <PageHeader
        title={c.fullName}
        description={`${c.phone}${c.email ? ` · ${c.email}` : ""}`}
        action={<StatusBadge status={c.status} />}
      />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section title="Profile">
          <KeyValueList
            items={[
              { label: "KYC tier", value: `Tier ${c.kycTier}` },
              { label: "Orders", value: c.ordersCount },
              { label: "Total spent", value: <Money amount={c.totalSpent} /> },
              {
                label: "Customer since",
                value: <RelativeTime value={c.createdAt} />,
              },
            ]}
          />
        </Section>
        <Section title="Wallet">
          <KeyValueList
            items={[
              {
                label: "Available balance",
                value: <Money amount={c.wallet.available} />,
              },
              {
                label: "Wallet status",
                value: (
                  <StatusBadge status={c.wallet.frozen ? "FROZEN" : "ACTIVE"} />
                ),
              },
            ]}
          />
          <Link
            to={`/admin/wallets/${c.id}`}
            className="mt-2 inline-block text-sm text-primary hover:underline"
          >
            Open wallet in banking
          </Link>
        </Section>
      </div>
      <div className="mt-8 space-y-8">
        <Section title="Addresses">
          {c.addresses.length ? (
            <ul className="divide-y divide-border text-sm">
              {c.addresses.map((a) => (
                <li key={a.id} className="py-2">
                  <span className="font-medium">{a.recipient}</span>{" "}
                  <span className="text-muted-foreground">{a.phone}</span>
                  {a.isDefault && (
                    <span className="ml-2 rounded-sm border border-border px-1.5 text-xs">
                      Default
                    </span>
                  )}
                  <p className="text-muted-foreground">{a.address}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No saved addresses.</p>
          )}
        </Section>
        <Section title="Recent wallet transactions">
          {c.recentTransactions.length ? (
            <div className="overflow-x-auto border-y border-border">
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th scope="col" className="p-2">
                      Type
                    </th>
                    <th scope="col" className="p-2">
                      Reference
                    </th>
                    <th scope="col" className="p-2">
                      Status
                    </th>
                    <th scope="col" className="p-2 text-right">
                      Amount
                    </th>
                    <th scope="col" className="p-2">
                      When
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {c.recentTransactions.map((t) => (
                    <tr key={t.id} className="border-t border-border">
                      <td className="p-2">{humanLabel(t.type)}</td>
                      <td className="p-2 font-mono text-xs">{t.reference}</td>
                      <td className="p-2">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="p-2 text-right">
                        {t.direction === "IN" ? "+" : "−"}
                        <Money amount={t.amount} />
                      </td>
                      <td className="p-2 text-muted-foreground">
                        <RelativeTime value={t.createdAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No transactions yet.
            </p>
          )}
        </Section>
        <Section title="Recent orders">
          <OrderRowsTable rows={c.recentOrders} showCustomer={false} />
        </Section>
      </div>
    </>
  );
}
