import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Big from "big.js";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { payments } from "../transactions/lookups";
import {
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
  StatusBadge,
  PaymentMethod,
} from "../../components/shared";
function day(offset: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
const statuses = ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "REFUNDED"];
export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const days = [7, 30, 90].includes(Number(params.get("days")))
    ? Number(params.get("days"))
    : 30;
  const metric = ["volume", "count", "success"].includes(
    params.get("metric") ?? "",
  )
    ? params.get("metric")!
    : "volume";
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next);
  };
  useEffect(() => {
    document.title = "Dashboard | Payment Project";
  }, []);
  const query = useQuery({
    queryKey: ["dashboard", days],
    queryFn: async () => {
      const [current, previous, all, events] = await Promise.all([
        api.GET("/payments/summary", {
          params: { query: { from: day(1 - days), to: day(0) } },
        }),
        api.GET("/payments/summary", {
          params: { query: { from: day(1 - 2 * days), to: day(-days) } },
        }),
        payments(),
        api.GET("/outbox-events", {
          params: {
            query: { status: "FAILED", size: 5, sort: "createdAt,desc" },
          },
        }),
      ]);
      if (current.error) throw current.error;
      if (previous.error) throw previous.error;
      if (events.error) throw events.error;
      return {
        current: current.data,
        previous: previous.data,
        all: all.filter(
          (p) =>
            p.createdAt.slice(0, 10) >= day(1 - days) &&
            p.createdAt.slice(0, 10) <= day(0),
        ),
      };
    },
  });
  if (query.isLoading)
    return (
      <>
        <PageHeader title="Dashboard" />
        <div
          role="status"
          className="h-72 animate-pulse bg-muted motion-reduce:animate-none"
        >
          Loading dashboard…
        </div>
      </>
    );
  if (query.isError || !query.data)
    return (
      <>
        <PageHeader title="Dashboard" />
        <ErrorState retry={() => void query.refetch()} />
      </>
    );
  const { current: s, previous, all } = query.data,
    completed = s.byStatus.find((x) => x.status === "COMPLETED")?.count ?? 0;
  const success = s.totalCount ? (completed / s.totalCount) * 100 : 0,
    avg = s.totalCount
      ? new Big(s.totalAmount).div(s.totalCount).round(0).toFixed()
      : "0";
  const delta = new Big(previous.totalAmount).eq(0)
    ? "No previous baseline"
    : `${new Big(s.totalAmount).minus(previous.totalAmount).div(previous.totalAmount).times(100).round(1).toFixed()}% vs previous period`;
  const daily = Array.from({ length: days }, (_, i) => {
    const date = day(i + 1 - days);
    return (
      s.daily.find((v) => v.date === date) ?? { date, count: 0, amount: "0" }
    );
  });
  const values = daily.map((d) =>
    metric === "volume"
      ? new Big(d.amount)
      : metric === "count"
        ? new Big(d.count)
        : new Big(
            all.filter(
              (p) =>
                p.createdAt.slice(0, 10) === d.date && p.status === "COMPLETED",
            ).length,
          )
            .div(d.count || 1)
            .times(100),
  );
  const max = values.reduce((a, b) => (a.gt(b) ? a : b), new Big(0));
  const points = values
    .map(
      (v, i) =>
        `${(i * 100) / (values.length - 1)},${95 - (max.eq(0) ? 0 : v.div(max).times(85).toNumber())}`,
    )
    .join(" ");
  const counts = statuses.map(
    (status) => s.byStatus.find((x) => x.status === status)?.count ?? 0,
  );
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Payment activity for the selected period."
        action={
          <label className="text-sm">
            Period{" "}
            <select
              value={days}
              onChange={(e) => update("days", e.target.value)}
              className="rounded border border-border bg-background p-2"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>
        }
      />
      {s.totalCount === 0 ? (
        <EmptyState
          title="No payment activity"
          description="Payments in this period will appear here."
          action={
            <Link className="text-primary underline" to="/admin/payments/new">
              Create a payment
            </Link>
          }
        />
      ) : (
        <>
          <section className="overview-band" aria-label="Period metrics">
            <div className="overview-volume">
              <span>Total volume</span>
              <div className="overview-hero">
                <strong>
                  <Money amount={s.totalAmount} />
                </strong>
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <polyline
                    points={points}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>
              <p>{delta}</p>
            </div>
            <div>
              <span>Payments</span>
              <strong>{s.totalCount}</strong>
            </div>
            <div>
              <span>Success rate</span>
              <strong>{success.toFixed(1)}%</strong>
            </div>
            <div>
              <span>Average payment</span>
              <strong>
                <Money amount={avg} />
              </strong>
            </div>
          </section>
          <section className="overview-chart">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Payment volume</h2>
                <p className="text-sm text-muted-foreground">
                  Daily activity · Last {days} days
                </p>
              </div>
              <div className="flex gap-1" aria-label="Chart metric">
                {["volume", "count", "success"].map((m) => (
                  <button
                    key={m}
                    aria-pressed={metric === m}
                    onClick={() => update("metric", m)}
                    className={`rounded px-3 py-2 text-sm ${metric === m ? "bg-muted font-semibold" : "hover:bg-muted"}`}
                  >
                    {m === "volume"
                      ? "Volume"
                      : m === "count"
                        ? "Count"
                        : "Success rate"}
                  </button>
                ))}
              </div>
            </div>
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              role="img"
              aria-label={
                metric === "volume"
                  ? "Daily payment volume"
                  : `Daily payment ${metric}`
              }
              className="mt-5 h-52 w-full"
            >
              <polygon
                points={`0,100 ${points} 100,100`}
                fill="var(--primary)"
                opacity="0.12"
              />
              <polyline
                points={points}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{daily[0].date}</span>
              <span>{daily.at(-1)?.date}</span>
            </div>
            <details className="mt-3 text-sm">
              <summary>Daily values</summary>
              {daily.map((d, i) => (
                <p key={d.date}>
                  {d.date}:{" "}
                  {metric === "volume" ? (
                    <Money amount={d.amount} />
                  ) : metric === "count" ? (
                    d.count
                  ) : (
                    `${values[i].round(1).toFixed()}%`
                  )}
                </p>
              ))}
            </details>
          </section>
          <div className="overview-bottom">
            <section>
              <div className="flex justify-between">
                <h2 className="font-semibold">Recent payments</h2>
                <Link to="/admin/payments" className="text-primary">
                  View all
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="mt-4 w-full text-left text-sm">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="py-2">Payment</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[...all]
                      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                      .slice(0, 6)
                      .map((p) => (
                        <tr key={p.id}>
                          <td className="py-3">
                            <Link
                              className="font-mono text-primary"
                              title={p.id}
                              to={`/admin/payments/${p.id}`}
                            >
                              {p.id.slice(0, 8)}
                            </Link>
                          </td>
                          <td>
                            <PaymentMethod method={p.method} />
                          </td>
                          <td>
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="text-right">
                            <Money amount={p.amount} currency={p.currency} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section>
              <h2 className="font-semibold">Payment status</h2>
              <p className="text-sm text-muted-foreground">Last {days} days</p>
              <div className="status-stack" aria-hidden="true">
                {statuses.map((status, i) => (
                  <span
                    key={status}
                    style={{
                      width: `${s.totalCount ? (counts[i] / s.totalCount) * 100 : 0}%`,
                      background: `var(--status-${status.toLowerCase()})`,
                    }}
                  />
                ))}
              </div>
              <ul className="space-y-2">
                {statuses.map((status, i) => (
                  <li
                    key={status}
                    className="flex items-center justify-between"
                  >
                    <StatusBadge status={status} />
                    <strong>{counts[i]}</strong>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </>
  );
}
