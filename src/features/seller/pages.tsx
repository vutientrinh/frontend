import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, CircleX, Clock3, RotateCcw } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { MoneyText } from "../../components/shared";
import {
  useAdjustInventory,
  useDuplicateSellerProduct,
  useInventory,
  useInventoryMovements,
  useOnboarding,
  useSaveOnboarding,
  useSaveSellerSettings,
  useSellerDashboard,
  useSellerOrder,
  useSellerOrderAction,
  useSellerOrders,
  useSellerProduct,
  useSellerProductAction,
  useSellerProducts,
  useSellerSettings,
  useSubmitOnboarding,
} from "../commerce/api";
import type {
  OnboardingStep,
  OnboardingSteps,
  SellerSettings,
} from "../commerce/types";
const SellerProductForm = lazy(async () => ({
  default: (await import("./ProductForm")).ProductForm,
}));
const panel = "rounded-lg border border-border bg-card p-5";
const field = "grid gap-2 text-small font-medium";
function Header({
  title,
  action,
  mono = false,
}: {
  title: string;
  action?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1
        className={`text-h1 font-semibold ${mono ? "font-mono text-h2" : ""}`}
      >
        {title}
      </h1>
      {action}
    </div>
  );
}
function State({
  loading,
  error,
  retry,
  children,
}: {
  loading: boolean;
  error: boolean;
  retry: () => void;
  children: ReactNode;
}) {
  if (loading)
    return (
      <div role="status" className="animate-pulse rounded-md bg-muted p-8">
        Loading...
      </div>
    );
  if (error)
    return (
      <div role="alert" className={panel}>
        Unable to load this view. <Button onClick={retry}>Retry</Button>
      </div>
    );
  return children;
}
function Status({ value }: { value: string }) {
  const completed = [
    "APPROVED",
    "LIVE",
    "CONFIRMED",
    "PACKED",
    "SHIPPED",
    "DELIVERED",
    "COMPLETED",
  ].includes(value);
  const refunded = ["REFUNDED", "RETURNED"].includes(value);
  const failed = [
    "CANCELLED",
    "REJECTED",
    "FAILED",
    "DELIVERY_FAILED",
  ].includes(value);
  const Icon = completed
    ? CheckCircle2
    : refunded
      ? RotateCcw
      : failed
        ? CircleX
        : Clock3;
  const color = completed
    ? "text-status-completed"
    : refunded
      ? "text-status-refunded"
      : failed
        ? "text-status-failed"
        : "text-status-pending";
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${color}`}>
      <Icon size={14} aria-hidden="true" />{" "}
      {value
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())}
    </span>
  );
}
function ErrorText({ error }: { error: unknown }) {
  return error ? (
    <p role="alert" className="text-sm text-destructive">
      {error instanceof Error ? error.message : "Unable to save"}
    </p>
  ) : null;
}
function Search({ label = "Search" }: { label?: string }) {
  const [params, setParams] = useSearchParams();
  return (
    <label className={field}>
      {label}
      <Input
        value={params.get("q") ?? ""}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          if (e.target.value) next.set("q", e.target.value);
          else next.delete("q");
          next.delete("page");
          setParams(next, { replace: true });
        }}
      />
    </label>
  );
}
function Empty({ filtered, text }: { filtered: boolean; text: string }) {
  const [params, setParams] = useSearchParams();
  return (
    <p className="p-5 text-muted-foreground">
      {filtered
        ? "No results match your filters. Clear the filters to see more."
        : text}
      {filtered && (
        <Button
          onClick={() => {
            const next = new URLSearchParams(params);
            ["q", "status", "lowStock", "page"].forEach((key) =>
              next.delete(key),
            );
            setParams(next);
          }}
        >
          Clear filters
        </Button>
      )}
    </p>
  );
}
function Pager({ page, totalPages }: { page: number; totalPages: number }) {
  const [params, setParams] = useSearchParams();
  return (
    <div className="flex items-center gap-3 p-4 text-sm">
      <Button
        disabled={page <= 0}
        onClick={() => {
          const p = new URLSearchParams(params);
          p.set("page", String(page - 1));
          setParams(p);
        }}
      >
        Previous
      </Button>
      <span>
        Page {page + 1} of {Math.max(totalPages, 1)}
      </span>
      <Button
        disabled={page + 1 >= totalPages}
        onClick={() => {
          const p = new URLSearchParams(params);
          p.set("page", String(page + 1));
          setParams(p);
        }}
      >
        Next
      </Button>
    </div>
  );
}
export function Dashboard() {
  const q = useSellerDashboard();
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <>
      <Header title="Seller dashboard" />
      <State
        loading={q.isLoading}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        {q.data && (
          <>
            <div className="grid gap-4 border-y border-border py-5 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [
                  "To confirm",
                  q.data.toConfirm,
                  "/seller/orders?status=TO_CONFIRM",
                ],
                ["To pack", q.data.toPack, "/seller/orders?status=TO_PACK"],
                [
                  "Ready to ship",
                  q.data.readyToShip,
                  "/seller/orders?status=READY_TO_SHIP",
                ],
                [
                  "Low stock",
                  q.data.lowStockCount,
                  "/seller/inventory?lowStock=true",
                ],
              ].map(([label, value, to]) => (
                <Link
                  className="rounded p-2 hover:bg-muted"
                  key={String(label)}
                  to={String(to)}
                >
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {value}
                  </p>
                </Link>
              ))}
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <section className={panel}>
                <h2 className="font-semibold">Revenue today</h2>
                <p className="mt-3 text-h2 font-semibold tabular-nums">
                  <MoneyText amount={q.data.revenueToday.gross} />
                </p>
                <p className="text-sm text-muted-foreground">
                  Net{" "}
                  <MoneyText amount={q.data.revenueToday.net} size="small" />
                </p>
              </section>
              <section className={panel}>
                <h2 className="font-semibold">Last 30 days</h2>
                <p className="mt-3 text-h2 font-semibold tabular-nums">
                  <MoneyText amount={q.data.revenue30d.gross} />
                </p>
                <p className="text-sm text-muted-foreground">
                  Net <MoneyText amount={q.data.revenue30d.net} size="small" />
                </p>
              </section>
              <section className={panel}>
                <h2 className="font-semibold">Funds</h2>
                <p className="mt-3">
                  Pending escrow{" "}
                  <strong className="tabular-nums">
                    <MoneyText amount={q.data.pendingEscrow} size="small" />
                  </strong>
                </p>
                <p>
                  Wallet{" "}
                  <MoneyText amount={q.data.walletBalance} size="small" />
                </p>
              </section>
            </div>
            <section className="mt-6 grid gap-4 border-y border-border py-5 sm:grid-cols-2">
              <div>
                <h2 className="text-sm text-muted-foreground">
                  Cancellation rate
                </h2>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {q.data.cancelRate}%
                </p>
              </div>
              <div>
                <h2 className="text-sm text-muted-foreground">
                  Late shipment rate
                </h2>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {q.data.lateShipRate}%
                </p>
              </div>
            </section>
            <section className="mt-6">
              <h2 className="font-semibold">Confirmation deadlines</h2>
              {q.data.confirmDeadlines.length ? (
                q.data.confirmDeadlines.map((d) => (
                  <p key={d.orderId} className="border-b border-border py-3">
                    <Link
                      className="text-primary underline"
                      to={`/seller/orders/${d.orderId}`}
                    >
                      {d.orderNumber}
                    </Link>{" "}
                    - due {new Date(d.dueAt).toLocaleString()} (
                    {Math.max(
                      0,
                      Math.ceil((Date.parse(d.dueAt) - clock) / 60000),
                    )}{" "}
                    minutes left)
                  </p>
                ))
              ) : (
                <Empty
                  filtered={false}
                  text="No orders awaiting confirmation."
                />
              )}
            </section>
          </>
        )}
      </State>
    </>
  );
}
const steps: OnboardingStep[] = ["shop", "owner", "documents", "bank", "terms"];
const labels: Record<OnboardingStep, [string, string][]> = {
  shop: [
    ["shopName", "Shop name"],
    ["slug", "Shop URL"],
    ["description", "Description"],
    ["location", "Location"],
    ["contactPhone", "Contact phone"],
    ["contactEmail", "Contact email"],
  ],
  owner: [
    ["fullName", "Owner full name"],
    ["dateOfBirth", "Date of birth"],
    ["idNumber", "ID number"],
    ["idFrontImage", "ID front file name"],
    ["idBackImage", "ID back file name"],
  ],
  documents: [
    ["businessType", "Business type"],
    ["businessRegistrationNo", "Registration number"],
    ["taxCode", "Tax code"],
    ["documentNames", "Document names (comma separated)"],
  ],
  bank: [
    ["bankName", "Bank name"],
    ["accountNumber", "Account number"],
    ["accountHolder", "Account holder"],
  ],
  terms: [
    ["acceptedCommissionPlan", "Commission plan"],
    ["acceptedAt", "Accepted at"],
  ],
};
export function Onboarding() {
  const q = useOnboarding();
  const save = useSaveOnboarding();
  const submit = useSubmitOnboarding();
  const [chosen, setChosen] = useState<OnboardingStep>();
  const step = chosen ?? q.data?.currentStep ?? "shop";
  const submitStep = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    if (step === "documents")
      values.documentNames = String(values.documentNames)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) as unknown as FormDataEntryValue;
    if (step === "terms") {
      delete values.accepted;
      values.acceptedCommissionPlan = "STANDARD_5";
      values.acceptedAt = new Date().toISOString();
    }
    save.mutate(
      {
        step,
        data: values as unknown as NonNullable<OnboardingSteps[OnboardingStep]>,
      },
      { onSuccess: (result) => setChosen(result.currentStep) },
    );
  };
  return (
    <>
      <Header title="Seller onboarding" />
      <State
        loading={q.isLoading}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        {q.data &&
          (q.data.status !== "DRAFT" && q.data.status !== "REJECTED" ? (
            <section className={panel}>
              <Status value={q.data.status} />
              <p className="mt-3">
                {q.data.status === "APPROVED"
                  ? "Your shop is approved."
                  : "Your application is under review."}
              </p>
            </section>
          ) : (
            <>
              <p className="mb-4 text-muted-foreground">
                Complete and save each step before submitting your shop.
              </p>
              <nav
                aria-label="Onboarding steps"
                className="mb-6 flex flex-wrap gap-2"
              >
                {steps.map((s, i) => (
                  <Button
                    key={s}
                    onClick={() => setChosen(s)}
                    aria-current={step === s ? "step" : undefined}
                  >
                    {i + 1}. {s}
                  </Button>
                ))}
              </nav>
              {q.data.rejectionReason && (
                <p role="alert">{q.data.rejectionReason}</p>
              )}
              <form
                key={step}
                onSubmit={submitStep}
                className={`${panel} grid max-w-2xl gap-4`}
              >
                <h2 className="text-lg font-semibold capitalize">{step}</h2>
                {step === "terms" ? (
                  <label className="flex items-start gap-2">
                    <input
                      name="accepted"
                      type="checkbox"
                      required
                      defaultChecked={!!q.data.steps.terms}
                    />{" "}
                    I accept the standard 5% commission plan.
                  </label>
                ) : (
                  labels[step].map(([name, label]) => (
                    <label key={name} className={field}>
                      {label}
                      {name === "businessType" ? (
                        <select
                          name={name}
                          className="rounded border border-border bg-background p-2"
                          defaultValue={
                            q.data.steps.documents?.businessType ?? "INDIVIDUAL"
                          }
                        >
                          <option value="INDIVIDUAL">Individual</option>
                          <option value="HOUSEHOLD">Household</option>
                          <option value="COMPANY">Company</option>
                        </select>
                      ) : (
                        <Input
                          name={name}
                          type={
                            name === "dateOfBirth"
                              ? "date"
                              : name === "contactEmail"
                                ? "email"
                                : "text"
                          }
                          required={
                            ![
                              "businessRegistrationNo",
                              "taxCode",
                              "documentNames",
                            ].includes(name)
                          }
                          defaultValue={String(
                            (
                              q.data?.steps[step] as unknown as
                                Record<string, unknown> | undefined
                            )?.[name] ??
                              (name === "businessType"
                                ? "INDIVIDUAL"
                                : name === "acceptedCommissionPlan"
                                  ? "STANDARD_5"
                                  : ""),
                          )}
                        />
                      )}
                    </label>
                  ))
                )}
                <ErrorText error={save.error} />
                <Button type="submit" disabled={save.isPending}>
                  Save and continue
                </Button>
              </form>
              <div className="mt-4">
                <Button
                  onClick={() => submit.mutate()}
                  disabled={submit.isPending}
                >
                  Submit application
                </Button>
                <ErrorText error={submit.error} />
              </div>
            </>
          ))}
      </State>
    </>
  );
}
export function Products() {
  const [params, setParams] = useSearchParams();
  const q = useSellerProducts({
    q: params.get("q") ?? undefined,
    status: params.get("status") ?? undefined,
    page: params.get("page") ?? undefined,
  });
  const action = useSellerProductAction();
  const duplicate = useDuplicateSellerProduct();
  return (
    <>
      <Header
        title="Products"
        action={
          <Button asChild>
            <Link to="/seller/products/new">Add product</Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <Search label="Search products" />
        <label className={field}>
          Status
          <select
            className="rounded-md border border-border bg-background p-2"
            value={params.get("status") ?? ""}
            onChange={(e) => {
              const p = new URLSearchParams(params);
              if (e.target.value) p.set("status", e.target.value);
              else p.delete("status");
              p.delete("page");
              setParams(p);
            }}
          >
            <option value="">All statuses</option>
            {["DRAFT", "PENDING_REVIEW", "LIVE", "REJECTED", "HIDDEN"].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
        </label>
      </div>
      <State
        loading={q.isLoading}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        {q.data &&
          (q.data.content.length ? (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-left text-small">
                <thead className="bg-muted">
                  <tr>
                    {[
                      "Product",
                      "Variants",
                      "Price",
                      "Stock",
                      "Sales",
                      "Status",
                      "Actions",
                    ].map((x) => (
                      <th className="p-3" key={x}>
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {q.data.content.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="p-3">
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="mr-3 inline-block size-10 rounded border border-border object-cover"
                        />
                        <Link
                          className="text-primary underline"
                          to={`/seller/products/${p.id}`}
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="p-3 tabular-nums">{p.variantCount}</td>
                      <td className="p-3 text-right tabular-nums">
                        <MoneyText amount={p.price} size="small" />
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {p.totalStock}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {p.soldCount}
                      </td>
                      <td className="p-3">
                        <Status value={p.status} />
                      </td>
                      <td className="p-3">
                        <Button
                          disabled={duplicate.isPending}
                          onClick={() => duplicate.mutate(p.id)}
                        >
                          Duplicate
                        </Button>
                        {p.status === "LIVE" && (
                          <Button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Hide ${p.name}? Shoppers will no longer see it.`,
                                )
                              )
                                action.mutate({ id: p.id, action: "hide" });
                            }}
                          >
                            Hide
                          </Button>
                        )}
                        {p.status === "HIDDEN" && (
                          <Button
                            onClick={() =>
                              action.mutate({ id: p.id, action: "unhide" })
                            }
                          >
                            Unhide
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pager page={q.data.page} totalPages={q.data.totalPages} />
            </div>
          ) : (
            <Empty
              filtered={!!params.get("q") || !!params.get("status")}
              text="No products yet. Add a product to get started."
            />
          ))}
        <ErrorText error={action.error ?? duplicate.error} />
      </State>
    </>
  );
}
export function ProductEditor() {
  const { id } = useParams();
  const q = useSellerProduct(id ?? "");
  return (
    <>
      <Header title={id ? "Edit product" : "New product"} />
      {id ? (
        <State
          loading={q.isLoading}
          error={q.isError}
          retry={() => void q.refetch()}
        >
          {q.data && (
            <Suspense
              fallback={
                <div
                  role="status"
                  className="animate-pulse rounded-md bg-muted p-8"
                >
                  Loading product form…
                </div>
              }
            >
              <SellerProductForm key={q.data.id} product={q.data} />
            </Suspense>
          )}
        </State>
      ) : (
        <Suspense
          fallback={
            <div
              role="status"
              className="animate-pulse rounded-md bg-muted p-8"
            >
              Loading product form…
            </div>
          }
        >
          <SellerProductForm />
        </Suspense>
      )}
    </>
  );
}
export function Inventory() {
  const [params, setParams] = useSearchParams();
  const q = useInventory({
    q: params.get("q") ?? undefined,
    lowStock: params.get("lowStock") ?? undefined,
  });
  const adjust = useAdjustInventory();
  const selected = params.get("variant") ?? "";
  const setSelected = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("variant", value);
    else next.delete("variant");
    setParams(next);
  };
  const moves = useInventoryMovements(selected);
  const onAdjust = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    adjust.mutate({
      id: selected,
      delta: Number(data.get("delta")),
      reason: String(data.get("reason")),
    });
  };
  return (
    <>
      <Header title="Inventory" />
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <Search label="Search inventory" />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={params.get("lowStock") === "true"}
            onChange={(e) => {
              const p = new URLSearchParams(params);
              if (e.target.checked) p.set("lowStock", "true");
              else p.delete("lowStock");
              setParams(p);
            }}
          />{" "}
          Low stock only
        </label>
      </div>
      <State
        loading={q.isLoading}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        {q.data &&
          (q.data.length ? (
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-small">
                <thead className="bg-muted">
                  <tr>
                    {[
                      "SKU",
                      "Product",
                      "On hand",
                      "Reserved",
                      "Available",
                      "",
                    ].map((x, i) => (
                      <th key={i} className="p-3">
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {q.data.map((row) => (
                    <tr key={row.variantId} className="border-t border-border">
                      <td className="p-3 font-mono text-caption">{row.sku}</td>
                      <td className="p-3">
                        {row.productName} - {row.variantLabel}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {row.onHand}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {row.reserved}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {row.available}
                      </td>
                      <td className="p-3">
                        <Button onClick={() => setSelected(row.variantId)}>
                          Adjust / movements
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              filtered={!!params.get("q") || !!params.get("lowStock")}
              text="No inventory yet."
            />
          ))}
      </State>
      {selected && (
        <section className={`${panel} mt-5`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              Adjust stock and movements
            </h2>
            <Button onClick={() => setSelected("")}>Close</Button>
          </div>
          <form onSubmit={onAdjust} className="mt-3 grid max-w-md gap-3">
            <label className={field}>
              Change in units
              <Input name="delta" type="number" required />
            </label>
            <label className={field}>
              Reason
              <Input name="reason" required />
            </label>
            <ErrorText error={adjust.error} />
            {adjust.isSuccess && <p role="status">Stock adjustment saved.</p>}
            <Button type="submit" disabled={adjust.isPending}>
              Save adjustment
            </Button>
          </form>
          <h3 className="mt-6 font-semibold">Movements</h3>
          <State
            loading={moves.isLoading}
            error={moves.isError}
            retry={() => void moves.refetch()}
          >
            {moves.data?.length ? (
              moves.data.map((m) => (
                <p className="border-b border-border py-2" key={m.id}>
                  {m.delta > 0 ? "+" : ""}
                  {m.delta} - {m.reason} - {new Date(m.at).toLocaleString()}
                </p>
              ))
            ) : (
              <Empty filtered={false} text="No movements yet." />
            )}
          </State>
        </section>
      )}
    </>
  );
}
const tabs = [
  ["TO_CONFIRM", "To confirm"],
  ["TO_PACK", "To pack"],
  ["READY_TO_SHIP", "Ready to ship"],
  ["SHIPPING", "Shipping"],
  ["DELIVERED", "Delivered"],
  ["CANCELLED", "Cancelled"],
  ["RETURNS", "Returns"],
] as const;
export function Orders() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "TO_CONFIRM";
  const q = useSellerOrders({ status, page: params.get("page") ?? undefined });
  const toConfirm = useSellerOrders({ status: "TO_CONFIRM", size: 1 });
  const toPack = useSellerOrders({ status: "TO_PACK", size: 1 });
  const ready = useSellerOrders({ status: "READY_TO_SHIP", size: 1 });
  const shipping = useSellerOrders({ status: "SHIPPING", size: 1 });
  const delivered = useSellerOrders({ status: "DELIVERED", size: 1 });
  const cancelled = useSellerOrders({ status: "CANCELLED", size: 1 });
  const returns = useSellerOrders({ status: "RETURNS", size: 1 });
  const counts = [
    toConfirm,
    toPack,
    ready,
    shipping,
    delivered,
    cancelled,
    returns,
  ];
  const action = useSellerOrderAction();
  const [rejecting, setRejecting] = useState<string>();
  const [rejectReason, setRejectReason] = useState("");
  const selected = params.getAll("selected");
  const setSelected = (values: string[]) => {
    const next = new URLSearchParams(params);
    next.delete("selected");
    values.forEach((value) => next.append("selected", value));
    setParams(next);
  };
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const bulk = async () => {
    let remaining = [...selected];
    try {
      for (const id of selected) {
        await action.mutateAsync({ id, action: "confirm" });
        remaining = remaining.filter((value) => value !== id);
      }
      setSelected([]);
    } catch {
      // Preserve only unconfirmed orders so retry can continue after partial success.
      setSelected(remaining);
    }
  };
  return (
    <>
      <Header title="Orders" />
      <nav
        aria-label="Order status"
        className="mb-5 flex gap-2 overflow-x-auto"
      >
        {tabs.map(([key, label], index) => (
          <Button
            key={key}
            aria-current={key === status ? "page" : undefined}
            onClick={() => {
              const p = new URLSearchParams(params);
              p.set("status", key);
              p.delete("page");
              p.delete("selected");
              setParams(p);
            }}
          >
            {label}
            {counts[index].data ? ` (${counts[index].data.totalElements})` : ""}
          </Button>
        ))}
      </nav>
      <State
        loading={q.isLoading}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        {q.data &&
          (q.data.content.length ? (
            <>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-left text-small">
                  <thead className="bg-muted">
                    <tr>
                      {status === "TO_CONFIRM" && (
                        <th className="p-3">Select</th>
                      )}
                      {[
                        "Order",
                        "Created",
                        "Status",
                        "Total",
                        "Deadline",
                        "Actions",
                      ].map((x) => (
                        <th key={x} className="p-3">
                          {x}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.content.map((o) => (
                      <tr key={o.id} className="border-t border-border">
                        {status === "TO_CONFIRM" && (
                          <td className="p-3">
                            <input
                              type="checkbox"
                              aria-label={`Select ${o.orderNumber}`}
                              checked={selected.includes(o.id)}
                              onChange={(e) =>
                                setSelected(
                                  e.target.checked
                                    ? [...selected, o.id]
                                    : selected.filter((id) => id !== o.id),
                                )
                              }
                            />
                          </td>
                        )}
                        <td className="p-3">
                          <Link
                            className="font-mono text-caption text-primary underline"
                            to={`/seller/orders/${o.id}`}
                          >
                            {o.orderNumber}
                          </Link>
                        </td>
                        <td className="p-3">
                          {new Date(o.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <Status value={o.status} />
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          <MoneyText amount={o.total} size="small" />
                        </td>
                        <td className="p-3">
                          {status === "TO_CONFIRM"
                            ? `${Math.max(0, Math.ceil((Date.parse(o.createdAt) + 86400000 - clock) / 60000))} minutes left`
                            : "-"}
                        </td>
                        <td className="p-3">
                          {o.status === "PAID" && (
                            <div className="grid gap-2">
                              <Button
                                disabled={action.isPending}
                                aria-label={`Confirm ${o.orderNumber}`}
                                onClick={() =>
                                  action.mutate({ id: o.id, action: "confirm" })
                                }
                              >
                                Confirm
                              </Button>
                              {rejecting === o.id ? (
                                <form
                                  className="grid min-w-48 gap-2"
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    if (
                                      window.confirm(
                                        `Reject ${o.orderNumber}? The order will be cancelled and refunded.`,
                                      )
                                    ) {
                                      action.mutate(
                                        {
                                          id: o.id,
                                          action: "reject",
                                          reason: rejectReason,
                                        },
                                        {
                                          onSuccess: () => {
                                            setRejecting(undefined);
                                            setRejectReason("");
                                          },
                                        },
                                      );
                                    }
                                  }}
                                >
                                  <label className={field}>
                                    Rejection reason
                                    <Input
                                      required
                                      value={rejectReason}
                                      onChange={(event) =>
                                        setRejectReason(event.target.value)
                                      }
                                    />
                                  </label>
                                  <Button
                                    type="submit"
                                    disabled={action.isPending}
                                  >
                                    Reject order
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setRejecting(undefined);
                                      setRejectReason("");
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </form>
                              ) : (
                                <Button
                                  disabled={action.isPending}
                                  aria-label={`Reject ${o.orderNumber}`}
                                  onClick={() => {
                                    setRejecting(o.id);
                                    setRejectReason("");
                                  }}
                                >
                                  Reject
                                </Button>
                              )}
                            </div>
                          )}
                          {o.status === "CONFIRMED" && (
                            <Button
                              disabled={action.isPending}
                              aria-label={`Pack ${o.orderNumber}`}
                              onClick={() =>
                                action.mutate({ id: o.id, action: "pack" })
                              }
                            >
                              Pack
                            </Button>
                          )}
                          {o.status === "PACKED" && (
                            <Button
                              disabled={action.isPending}
                              aria-label={`Hand over ${o.orderNumber}`}
                              onClick={() =>
                                action.mutate({ id: o.id, action: "handover" })
                              }
                            >
                              Hand over
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pager page={q.data.page} totalPages={q.data.totalPages} />
              </div>
              {status === "TO_CONFIRM" && (
                <Button
                  className="mt-4"
                  disabled={!selected.length || action.isPending}
                  onClick={() => void bulk()}
                >
                  Confirm selected ({selected.length})
                </Button>
              )}
              <ErrorText error={action.error} />
            </>
          ) : (
            <Empty
              filtered={false}
              text={`No orders in the ${tabs.find(([key]) => key === status)?.[1].toLowerCase() ?? "selected"} queue.`}
            />
          ))}
      </State>
    </>
  );
}
export function OrderDetail() {
  const { id = "" } = useParams();
  const q = useSellerOrder(id);
  const action = useSellerOrderAction();
  const [reason, setReason] = useState("");
  return (
    <>
      <Header title={q.data?.orderNumber ?? "Order detail"} mono />
      <State
        loading={q.isLoading}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        {q.data && (
          <div className="grid gap-5 lg:grid-cols-3">
            <section className={`${panel} lg:col-span-2`}>
              <div className="flex justify-between">
                <h2 className="font-semibold">Order items</h2>
                <Status value={q.data.status} />
              </div>
              {q.data.items.map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between gap-3 border-b border-border py-4"
                >
                  <div>
                    {item.name}
                    <p className="text-sm text-muted-foreground">
                      {item.variantLabel} - Qty {item.quantity}
                    </p>
                  </div>
                  <MoneyText amount={item.lineTotal} size="small" />
                </div>
              ))}
              <h2 className="mt-6 font-semibold">Delivery</h2>
              <p className="mt-2">
                {q.data.shippingAddress.recipient} -{" "}
                {q.data.shippingAddress.phone}
              </p>
              <p>{q.data.shippingAddress.address}</p>
              {q.data.shipment && (
                <div className="mt-2">
                  <p>
                    {q.data.shipment.carrier} - {q.data.shipment.trackingNo}
                  </p>
                  {q.data.shipment.events.length > 0 && (
                    <ol className="mt-2 border-l border-border pl-4">
                      {q.data.shipment.events.map((event, i) => (
                        <li
                          key={`${event.status}-${event.at}-${i}`}
                          className="py-1 text-sm"
                        >
                          <Status value={event.status} /> · {event.location} ·{" "}
                          {new Date(event.at).toLocaleString()}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
              <h2 className="mt-6 font-semibold">Activity</h2>
              <ol>
                {q.data.timeline.map((entry, i) => (
                  <li
                    key={i}
                    className="flex gap-2 border-b border-border py-3"
                  >
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <span>
                      <Status value={entry.status} /> -{" "}
                      {new Date(entry.at).toLocaleString()} {entry.note}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
            <aside className="space-y-5">
              <section className={panel}>
                <h2 className="font-semibold">Money breakdown</h2>
                {[
                  ["Gross", q.data.money.gross],
                  ["Commission", q.data.money.commission],
                  ["VAT on commission", q.data.money.vatOnCommission],
                  ["Net", q.data.money.net],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between gap-3 border-b border-border py-2"
                  >
                    <span>{label}</span>
                    <MoneyText amount={value} size="small" />
                  </div>
                ))}
                <p className="mt-3">
                  Escrow: <Status value={q.data.money.escrowStatus} />
                </p>
                <p className="mt-3">
                  Buyer: {q.data.buyer.maskedName} - {q.data.buyer.maskedPhone}
                </p>
                <div className="mt-3 border-t border-border pt-3 text-sm">
                  <p className="flex justify-between gap-3">
                    <span>Shipping</span>
                    <MoneyText amount={q.data.shippingFee} size="small" />
                  </p>
                  {q.data.discount !== "0" && (
                    <p className="flex justify-between gap-3">
                      <span>Discount</span>
                      <MoneyText
                        amount={q.data.discount}
                        size="small"
                        sign="minus"
                      />
                    </p>
                  )}
                </div>
              </section>
              <section className={`${panel} grid gap-3`}>
                <h2 className="font-semibold">Actions</h2>
                {q.data.status === "PAID" && (
                  <>
                    <Button
                      onClick={() => action.mutate({ id, action: "confirm" })}
                    >
                      Confirm order
                    </Button>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (
                          window.confirm(
                            "Reject this order? The order will be cancelled.",
                          )
                        )
                          action.mutate({ id, action: "reject", reason });
                      }}
                      className="grid gap-2"
                    >
                      <label className={field}>
                        Rejection reason
                        <Input
                          required
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </label>
                      <Button type="submit">Reject order</Button>
                    </form>
                  </>
                )}
                {q.data.status === "CONFIRMED" && (
                  <Button onClick={() => action.mutate({ id, action: "pack" })}>
                    Mark packed
                  </Button>
                )}
                {q.data.status === "PACKED" && (
                  <Button
                    onClick={() => action.mutate({ id, action: "handover" })}
                  >
                    Hand over to carrier
                  </Button>
                )}
                <ErrorText error={action.error} />
              </section>
            </aside>
          </div>
        )}
      </State>
    </>
  );
}
function SettingsForm({ initial }: { initial: SellerSettings }) {
  const [value, setValue] = useState(initial);
  const save = useSaveSellerSettings();
  const update = (key: keyof SellerSettings, v: string) =>
    setValue((prev) => ({ ...prev, [key]: v }));
  return (
    <form
      className="grid max-w-2xl gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(value);
      }}
    >
      {(
        [
          ["shopName", "Shop name"],
          ["description", "Description"],
          ["location", "Location"],
          ["contactPhone", "Contact phone"],
          ["contactEmail", "Contact email"],
          ["logoUrl", "Logo URL"],
          ["bannerUrl", "Banner URL"],
        ] as const
      ).map(([key, label]) => (
        <label className={field} key={key}>
          {label}
          <Input
            value={value[key] ?? ""}
            onChange={(e) => update(key, e.target.value)}
            required={!["logoUrl", "bannerUrl"].includes(key)}
          />
        </label>
      ))}
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-semibold">Notifications</legend>
        {(
          [
            ["newOrder", "New orders"],
            ["lowStock", "Low stock"],
            ["payout", "Payouts"],
          ] as const
        ).map(([key, label]) => (
          <label className="flex items-center gap-2" key={key}>
            <input
              type="checkbox"
              checked={value.notifications[key]}
              onChange={(e) =>
                setValue({
                  ...value,
                  notifications: {
                    ...value.notifications,
                    [key]: e.target.checked,
                  },
                })
              }
            />
            {label}
          </label>
        ))}
      </fieldset>
      <ErrorText error={save.error} />
      {save.isSuccess && <p role="status">Settings saved.</p>}
      <Button type="submit" disabled={save.isPending}>
        Save settings
      </Button>
    </form>
  );
}
export function Settings() {
  const q = useSellerSettings();
  return (
    <>
      <Header title="Shop settings" />
      <State
        loading={q.isLoading}
        error={q.isError}
        retry={() => void q.refetch()}
      >
        {q.data && <SettingsForm initial={q.data} />}
      </State>
    </>
  );
}
