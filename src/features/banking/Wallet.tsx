import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Big from "big.js";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BanknoteArrowDown,
  Eye,
  EyeOff,
  FileText,
  QrCode as QrCodeIcon,
  Send as SendIcon,
  WalletCards,
} from "lucide-react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Button } from "../../components/ui/button";
import { ErrorState, Money, StatusBadge } from "../../components/shared";
import { ApiError, request } from "./client";
import type {
  Page,
  Recipient,
  TopUp,
  Transaction,
  Transfer,
  Wallet,
} from "./types";
import { OtpChallenge } from "./OtpChallenge";
import { useAuth } from "./AuthContext";
const getWallet = () => request<Wallet>("/wallets/me");
const getTransactions = (query = "") =>
  request<Page<Transaction>>(`/wallets/me/transactions${query}`);
function AmountInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      Amount (VND)
      <input
        required
        inputMode="numeric"
        value={value.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className="mt-1 w-full rounded border border-border bg-background p-3 text-lg tabular-nums"
      />
    </label>
  );
}
function Failure({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorState
      message={error instanceof Error ? error.message : "Unable to load data."}
      retry={retry}
    />
  );
}
function QrCode({ payload, label }: { payload: string; label: string }) {
  const [result, setResult] = useState<{ payload: string; svg: string }>();
  const [failure, setFailure] = useState<{
    payload: string;
    message: string;
  }>();
  useEffect(() => {
    let active = true;
    void import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toString(payload, {
          type: "svg",
          errorCorrectionLevel: "M",
          margin: 2,
          width: 240,
        }),
      )
      .then((result) => {
        if (active) setResult({ payload, svg: result });
      })
      .catch(() => {
        if (active)
          setFailure({
            payload,
            message: "Could not create QR code. Copy the text below.",
          });
      });
    return () => {
      active = false;
    };
  }, [payload]);
  return (
    <div className="mt-5">
      {result?.payload === payload ? (
        <img
          className="h-60 w-60 rounded-md border border-border bg-card p-2"
          src={`data:image/svg+xml,${encodeURIComponent(result.svg)}`}
          alt={label}
          width={240}
          height={240}
        />
      ) : failure?.payload !== payload ? (
        <p role="status">Creating QR code…</p>
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {failure.message}
        </p>
      )}
    </div>
  );
}
function transactionTitle(transaction: Transaction) {
  if (transaction.type === "TOP_UP") return "Top-up";
  if (transaction.type === "TRANSFER_OUT")
    return `Sent to ${transaction.counterparty?.maskedName ?? "recipient"}`;
  if (transaction.type === "TRANSFER_IN")
    return `Received from ${transaction.counterparty?.maskedName ?? "sender"}`;
  if (transaction.type === "PAYMENT") return "Payment";
  if (transaction.type === "REFUND") return "Refund";
  return "Withdrawal";
}
function transactionIcon(transaction: Transaction) {
  if (transaction.type === "TOP_UP") return BanknoteArrowDown;
  if (transaction.type === "TRANSFER_IN") return ArrowDownLeft;
  if (transaction.direction === "OUT") return ArrowUpRight;
  return WalletCards;
}
function TransactionRows({ items }: { items: Transaction[] }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((transaction) => {
        const Icon = transactionIcon(transaction);
        const pending = transaction.status === "PENDING";
        return (
          <li key={transaction.id}>
            <Link
              to={
                transaction.status === "PENDING"
                  ? `/wallet/top-up/${transaction.id}`
                  : `/wallet/tx/${transaction.id}`
              }
              className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-3"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={`rounded-full bg-muted p-2 ${pending ? "text-muted-foreground" : transaction.direction === "IN" ? "text-status-completed" : "text-destructive"}`}
                >
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <strong className="block truncate">
                    {transactionTitle(transaction)}
                  </strong>
                  <span className="text-sm text-muted-foreground">
                    <time dateTime={transaction.createdAt}>
                      {new Date(transaction.createdAt).toLocaleDateString()}
                    </time>{" "}
                    · {transaction.reference}
                  </span>
                </span>
              </span>
              <span className="ml-auto text-right">
                <span
                  className={`font-medium ${pending ? "text-muted-foreground" : transaction.direction === "IN" ? "text-status-completed" : "text-destructive"}`}
                >
                  {transaction.direction === "IN" ? "+" : "−"}
                  <Money amount={transaction.amount} />
                </span>
                <br />
                {transaction.status === "PENDING" ? (
                  <StatusBadge status="PENDING" />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Balance <Money amount={transaction.balanceAfter} />
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
function Transactions({
  items,
  groupByDay = false,
}: {
  items: Transaction[];
  groupByDay?: boolean;
}) {
  if (!items.length)
    return (
      <p className="py-6 text-muted-foreground">
        No transactions yet.{" "}
        <Link className="text-primary" to="/wallet/top-up">
          Top up your wallet
        </Link>
      </p>
    );
  if (!groupByDay) return <TransactionRows items={items} />;
  const groups = new Map<string, Transaction[]>();
  for (const transaction of items) {
    const day = transaction.createdAt.slice(0, 10);
    groups.set(day, [...(groups.get(day) ?? []), transaction]);
  }
  return (
    <div className="space-y-5">
      {Array.from(groups, ([day, transactions]) => (
        <section key={day}>
          <h2 className="border-b border-border pb-2 text-sm font-semibold">
            {new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </h2>
          <TransactionRows items={transactions} />
        </section>
      ))}
    </div>
  );
}
export function WalletHome() {
  const [visible, setVisible] = useState(true),
    wallet = useQuery({ queryKey: ["wallet"], queryFn: getWallet }),
    transactions = useQuery({
      queryKey: ["wallet", "transactions", "recent"],
      queryFn: () => getTransactions("?size=5"),
    });
  if (wallet.isLoading) return <p role="status">Loading wallet…</p>;
  if (wallet.isError) {
    if (wallet.error instanceof ApiError && wallet.error.status === 404)
      return (
        <div>
          <h1 className="text-2xl font-semibold">Wallet</h1>
          <p className="my-4">Verify your identity to open a wallet.</p>
          <Link to="/me/verify" className="text-primary">
            Verify identity
          </Link>
        </div>
      );
    return <Failure error={wallet.error} retry={() => void wallet.refetch()} />;
  }
  const w = wallet.data!;
  const actions = [
    ["/wallet/top-up", "Top up", BanknoteArrowDown],
    ["/wallet/send", "Send", SendIcon],
    ["/wallet/statement", "Statement", FileText],
    ["/wallet/qr", "My QR", QrCodeIcon],
  ] as const;
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Wallet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Verified · Tier {w.kycTier}
            {w.status === "FROZEN" ? " · Frozen" : ""}
          </p>
        </div>
        <button
          aria-label={visible ? "Hide balance" : "Show balance"}
          className="flex min-h-11 items-center gap-2 rounded px-3 text-primary hover:bg-muted"
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          <span>{visible ? "Hide balance" : "Show balance"}</span>
        </button>
      </div>
      <section
        aria-label="Wallet balances"
        className="my-6 border-y border-border py-6"
      >
        <p className="text-sm text-muted-foreground">Available balance</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight">
          {visible ? (
            <Money amount={w.availableBalance} size="display" />
          ) : (
            "••••••"
          )}
        </p>
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <p>
            <span className="block text-muted-foreground">Ledger balance</span>
            {visible ? <Money amount={w.ledgerBalance} /> : "••••••"}
          </p>
          <p>
            <span className="block text-muted-foreground">Held</span>
            {visible ? <Money amount={w.heldAmount} /> : "••••••"}
          </p>
        </div>
      </section>
      <nav
        aria-label="Wallet actions"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {actions.map(([url, label, Icon]) => (
          <Link
            key={url}
            to={url}
            className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-3 text-sm font-medium text-primary hover:bg-muted"
          >
            <Icon size={20} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <section className="mt-8">
        <h2 className="font-semibold">Monthly limit</h2>
        <p className="mt-2">
          <Money amount={w.limits.monthlyOutflowUsed} /> of{" "}
          <Money amount={w.limits.monthlyOutflow} /> used
        </p>
        <progress
          className="mt-3 w-full max-w-md"
          aria-label="Monthly outflow used"
          max={100}
          value={Math.min(
            100,
            new Big(w.limits.monthlyOutflowUsed)
              .div(w.limits.monthlyOutflow)
              .times(100)
              .toNumber(),
          )}
        />
      </section>
      <section className="mt-8">
        <div className="flex justify-between">
          <h2 className="font-semibold">Recent transactions</h2>
          <Link to="/wallet/statement" className="text-primary">
            View all
          </Link>
        </div>
        {transactions.isLoading ? (
          <p role="status">Loading transactions…</p>
        ) : transactions.isError ? (
          <Failure
            error={transactions.error}
            retry={() => void transactions.refetch()}
          />
        ) : (
          <Transactions items={transactions.data?.content ?? []} />
        )}
      </section>
    </div>
  );
}
export function TopUpForm() {
  const [amount, setAmount] = useState(""),
    [error, setError] = useState(""),
    key = useRef(crypto.randomUUID()),
    navigate = useNavigate();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const t = await request<TopUp>("/wallets/me/top-ups", {
        method: "POST",
        headers: { "Idempotency-Key": key.current },
        body: JSON.stringify({ amount, method: "VIETQR" }),
      });
      navigate(`/wallet/top-up/${t.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create top-up.");
    }
  }
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold">Top up</h1>
      <p className="mt-2 text-muted-foreground">VietQR · Fee 0 ₫</p>
      <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
        <AmountInput
          value={amount}
          onChange={(v) => {
            setAmount(v);
            key.current = crypto.randomUUID();
          }}
        />
        <div className="flex flex-wrap gap-2">
          {["100000", "200000", "500000"].map((v) => (
            <button
              type="button"
              key={v}
              className="rounded border border-border p-2"
              onClick={() => {
                setAmount(v);
                key.current = crypto.randomUUID();
              }}
            >
              <Money amount={v} />
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <Button type="submit">Create top-up</Button>
      </form>
    </div>
  );
}
export function TopUpStatus() {
  const { id = "" } = useParams(),
    client = useQueryClient(),
    [clock, setClock] = useState(() => Date.now());
  const query = useQuery({
    queryKey: ["topup", id],
    queryFn: () => request<TopUp>(`/top-ups/${id}`),
    refetchInterval: (q) => (q.state.data?.status === "PENDING" ? 2000 : false),
  });
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (query.data?.status === "COMPLETED")
      void client.invalidateQueries({ queryKey: ["wallet"] });
  }, [query.data?.status, client]);
  if (query.isLoading) return <p role="status">Loading top-up…</p>;
  if (query.isError || !query.data)
    return <Failure error={query.error} retry={() => void query.refetch()} />;
  const t = query.data,
    seconds = Math.max(0, Math.ceil((Date.parse(t.expiresAt) - clock) / 1000));
  return (
    <div>
      <h1 className="text-2xl font-semibold">Top-up status</h1>
      <div className="mt-5">
        <StatusBadge status={t.status} />
      </div>
      <p className="mt-4 text-3xl font-semibold">
        <Money amount={t.amount} />
      </p>
      <p className="mt-4">
        Reference: <strong>{t.reference}</strong>
      </p>
      <button
        onClick={() => void navigator.clipboard.writeText(t.reference)}
        className="mt-2 text-primary"
      >
        Copy reference
      </button>
      {t.status === "PENDING" && (
        <QrCode payload={t.qrPayload} label={`Top-up QR for ${t.reference}`} />
      )}
      <p className="mt-3 break-all text-sm">QR payload: {t.qrPayload}</p>
      {t.status === "PENDING" && (
        <p className="mt-3">
          Expires in {Math.floor(seconds / 60)}:
          {String(seconds % 60).padStart(2, "0")}
        </p>
      )}
      <p className="mt-4 text-sm text-muted-foreground">
        Wallet credit follows bank confirmation.
      </p>
      <Link className="mt-5 inline-block text-primary" to="/bank-sim">
        Open bank simulator
      </Link>
    </div>
  );
}
export function Statement() {
  const [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState("");
  const [params, setParams] = useSearchParams(),
    query = useQuery({
      queryKey: ["wallet", "transactions", params.toString()],
      queryFn: () => getTransactions(`?${params.toString()}`),
    });
  function update(k: string, v: string) {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    n.delete("page");
    setParams(n);
  }
  async function csv() {
    if (!query.data) return;
    setExporting(true);
    setExportError("");
    try {
      const filters = new URLSearchParams(params);
      filters.set("size", "100");
      filters.set("page", "0");
      const all: Transaction[] = [];
      let page = 0,
        total = 1;
      while (page < total) {
        filters.set("page", String(page));
        const result = await getTransactions(`?${filters.toString()}`);
        all.push(...result.content);
        total = result.totalPages;
        page++;
      }
      const rows = [
        ["Date", "Type", "Direction", "Amount VND", "Balance VND", "Reference"],
        ...all.map((t) => [
          t.createdAt,
          t.type,
          t.direction,
          t.amount,
          t.balanceAfter,
          t.reference,
        ]),
      ];
      const text = rows
        .map((row) =>
          row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","),
        )
        .join("\r\n");
      const url = URL.createObjectURL(
        new Blob([text], { type: "text/csv;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "wallet-statement.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(
        e instanceof Error ? e.message : "Could not export statement.",
      );
    } finally {
      setExporting(false);
    }
  }
  return (
    <div>
      <div className="flex flex-wrap justify-between gap-3">
        <h1 className="text-2xl font-semibold">Statement</h1>
        <Button
          onClick={() => void csv()}
          disabled={exporting || !query.data?.totalElements}
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>
      {exportError && (
        <p role="alert" className="mt-3 text-destructive">
          {exportError}
        </p>
      )}
      <div className="my-5 flex flex-wrap gap-3">
        {["from", "to"].map((k) => (
          <label key={k} className="text-sm">
            {k === "from" ? "From" : "To"}
            <input
              type="date"
              value={params.get(k) ?? ""}
              onChange={(e) => update(k, e.target.value)}
              className="ml-2 rounded border border-border bg-background p-2"
            />
          </label>
        ))}
        <label className="text-sm">
          Type{" "}
          <select
            value={params.get("type") ?? ""}
            onChange={(e) => update("type", e.target.value)}
            className="rounded border border-border bg-background p-2"
          >
            <option value="">All</option>
            {[
              "TOP_UP",
              "TRANSFER_IN",
              "TRANSFER_OUT",
              "PAYMENT",
              "REFUND",
              "WITHDRAWAL",
            ].map((x) => (
              <option key={x} value={x}>
                {x.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Direction{" "}
          <select
            value={params.get("direction") ?? ""}
            onChange={(e) => update("direction", e.target.value)}
            className="rounded border border-border bg-background p-2"
          >
            <option value="">All</option>
            <option value="IN">Incoming</option>
            <option value="OUT">Outgoing</option>
          </select>
        </label>
      </div>
      {query.isLoading ? (
        <p role="status">Loading statement…</p>
      ) : query.isError ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <section
            aria-label="Filtered statement totals"
            className="my-5 grid gap-3 rounded-md border border-border p-4 sm:grid-cols-3"
          >
            <p>
              <span className="block text-sm text-muted-foreground">
                Total in
              </span>
              <Money amount={query.data?.summary?.totalIn ?? "0"} />
            </p>
            <p>
              <span className="block text-sm text-muted-foreground">
                Total out
              </span>
              <Money amount={query.data?.summary?.totalOut ?? "0"} />
            </p>
            <p>
              <span className="block text-sm text-muted-foreground">Net</span>
              <Money
                amount={new Big(query.data?.summary?.totalIn ?? "0")
                  .minus(query.data?.summary?.totalOut ?? "0")
                  .toFixed()}
              />
            </p>
          </section>
          {!query.data?.content.length &&
          ["from", "to", "type", "direction"].some((key) => params.has(key)) ? (
            <p className="py-6">
              No transactions match these filters.{" "}
              <button
                className="text-primary underline"
                onClick={() => setParams(new URLSearchParams())}
              >
                Clear filters
              </button>
            </p>
          ) : (
            <Transactions items={query.data?.content ?? []} />
          )}
          <div className="flex justify-between py-4">
            <Button
              disabled={!query.data?.page}
              onClick={() => {
                const n = new URLSearchParams(params);
                n.set("page", String((query.data?.page ?? 0) - 1));
                setParams(n);
              }}
            >
              Previous
            </Button>
            <span>Page {(query.data?.page ?? 0) + 1}</span>
            <Button
              disabled={
                (query.data?.page ?? 0) + 1 >= (query.data?.totalPages ?? 0)
              }
              onClick={() => {
                const n = new URLSearchParams(params);
                n.set("page", String((query.data?.page ?? 0) + 1));
                setParams(n);
              }}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
export function TransactionDetail() {
  const { id = "" } = useParams(),
    query = useQuery({
      queryKey: ["wallet", "transaction", id],
      queryFn: () => request<Transaction>(`/wallets/me/transactions/${id}`),
    });
  if (query.isLoading) return <p role="status">Loading transaction…</p>;
  if (query.isError || !query.data)
    return <Failure error={query.error} retry={() => void query.refetch()} />;
  const t = query.data;
  return (
    <div>
      <Link to="/wallet/statement" className="text-primary">
        ← Statement
      </Link>
      <h1 className="mt-5 text-2xl font-semibold">{transactionTitle(t)}</h1>
      <p
        className={`mt-4 text-3xl ${t.direction === "IN" ? "text-status-completed" : "text-destructive"}`}
      >
        {t.direction === "IN" ? "+" : "−"}
        <Money amount={t.amount} />
      </p>
      <p className="mt-4">
        <StatusBadge status={t.status} />
      </p>
      <p className="mt-4">
        {t.counterparty?.maskedName} {t.counterparty?.maskedPhone}
      </p>
      <p>Reference: {t.reference}</p>
      <p>
        Balance after: <Money amount={t.balanceAfter} />
      </p>
      <p>Journal: {t.journalId}</p>
      {t.note && <p>Note: {t.note}</p>}
      <h2 className="mt-6 font-semibold">Timeline</h2>
      <ol className="mt-3 space-y-2">
        {t.timeline.map((item, index) => (
          <li key={`${item.createdAt}-${index}`}>
            <StatusBadge status={item.status} />{" "}
            <time dateTime={item.createdAt}>
              {new Date(item.createdAt).toLocaleString()}
            </time>
          </li>
        ))}
      </ol>
    </div>
  );
}
export function Receipt() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["wallet", "transaction", id],
    queryFn: () => request<Transaction>(`/wallets/me/transactions/${id}`),
  });
  const [message, setMessage] = useState("");
  if (query.isLoading) return <p role="status">Loading receipt…</p>;
  if (query.isError || !query.data)
    return <Failure error={query.error} retry={() => void query.refetch()} />;
  const tx = query.data;
  const receiptText = `Transfer receipt\nSender: ${user?.fullName ?? user?.phone ?? ""}\nAmount: ${tx.amount} VND\nReference: ${tx.reference}\nRecipient: ${tx.counterparty?.maskedName ?? ""}\nNote: ${tx.note || "No note"}\nFee: 0 VND\nTime: ${new Date(tx.createdAt).toLocaleString()}`;
  const share = async () => {
    try {
      if (navigator.share)
        await navigator.share({ title: "Transfer receipt", text: receiptText });
      else await navigator.clipboard.writeText(receiptText);
      setMessage("Receipt details shared or copied.");
    } catch {
      setMessage("Unable to share receipt.");
    }
  };
  return (
    <div>
      <Link className="text-primary" to="/wallet">
        ← Wallet
      </Link>
      <h1 className="mt-5 text-2xl font-semibold">Transfer receipt</h1>
      <p className="mt-4 text-3xl font-semibold">
        <Money amount={tx.amount} />
      </p>
      <p className="mt-3">
        <StatusBadge status={tx.status} />
      </p>
      <dl className="mt-5 space-y-3">
        <div>
          <dt className="text-muted-foreground">Recipient</dt>
          <dd>
            {tx.counterparty?.maskedName} · {tx.counterparty?.maskedPhone}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Sender</dt>
          <dd>{user?.fullName ?? user?.phone}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Note</dt>
          <dd>{tx.note || "No note"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Fee</dt>
          <dd>
            <Money amount="0" />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Reference</dt>
          <dd>{tx.reference}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Time</dt>
          <dd>{new Date(tx.createdAt).toLocaleString()}</dd>
        </div>
      </dl>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          onClick={() => {
            void navigator.clipboard
              .writeText(receiptText)
              .then(() => setMessage("Receipt copied."))
              .catch(() => setMessage("Could not copy receipt."));
          }}
        >
          Copy receipt
        </Button>
        <Button
          className="border border-border bg-background text-foreground"
          onClick={() => void share()}
        >
          Share
        </Button>
      </div>
      {message && (
        <p role="status" className="mt-3">
          {message}
        </p>
      )}
    </div>
  );
}
export function MyQr() {
  const [amount, setAmount] = useState(""),
    [note, setNote] = useState(""),
    [message, setMessage] = useState("");
  const q = useQuery({
    queryKey: ["wallet", "qr"],
    queryFn: () =>
      request<{ payload: string; maskedName: string }>("/wallets/me/qr"),
  });
  const payload = q.data
    ? `${q.data.payload}${amount ? `|amount=${amount}` : ""}${note.trim() ? `|note=${note.trim()}` : ""}`
    : "";
  const paymentLink = q.data
    ? `https://demo.local/pay?${new URLSearchParams({ to: q.data.payload.replace("PAYMENT:", ""), ...(amount ? { amount } : {}), ...(note.trim() ? { note: note.trim() } : {}) })}`
    : "";
  return (
    <div>
      <h1 className="text-2xl font-semibold">My QR</h1>
      {q.isLoading ? (
        <p>Loading…</p>
      ) : q.isError ? (
        <Failure error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <p className="mt-4">{q.data?.maskedName}</p>
          <div className="mt-5 max-w-md space-y-4">
            <AmountInput
              value={amount}
              onChange={(value) => setAmount(value)}
            />
            <label className="block text-sm">
              Note (optional)
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={120}
                className="mt-1 w-full rounded border border-border bg-background p-3"
              />
            </label>
          </div>
          <QrCode payload={payload} label="My wallet payment QR code" />
          {amount && (
            <p className="mt-3">
              Amount: <Money amount={amount} />
            </p>
          )}
          <p className="mt-3 break-all text-sm">QR payload: {payload}</p>
          <Button
            className="mt-3 border border-border bg-background text-foreground"
            onClick={() => {
              void navigator.clipboard
                .writeText(paymentLink)
                .then(() => setMessage("Payment link copied."));
            }}
          >
            Copy payment link
          </Button>
          {message && (
            <p role="status" className="mt-2">
              {message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
export function Send() {
  const [step, setStep] = useState(1),
    [search, setSearch] = useState(""),
    [recipient, setRecipient] = useState<Recipient | null>(null),
    [amount, setAmount] = useState(""),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState<Transfer | null>(null),
    [otp, setOtp] = useState<{
      otpId: string;
      resendAvailableAt: string;
      expiresAt: string;
    } | null>(null),
    [code, setCode] = useState(""),
    key = useRef(crypto.randomUUID()),
    confirmKey = useRef(crypto.randomUUID()),
    navigate = useNavigate(),
    client = useQueryClient();
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: getWallet }),
    contacts = useQuery({
      queryKey: ["wallet", "contacts"],
      queryFn: () => request<Recipient[]>("/wallets/me/contacts"),
    });
  const lookup = useMutation({
    meta: { suppressSuccessToast: true },
    mutationFn: () =>
      request<Recipient>(
        `/wallets/recipients/lookup?q=${encodeURIComponent(search)}`,
      ),
    onSuccess: (r) => {
      key.current = crypto.randomUUID();
      setRecipient(r);
      setError("");
    },
    onError: (e) => setError(e.message),
  });
  async function send() {
    setError("");
    try {
      const t = await request<Transfer>("/wallets/me/transfers", {
        method: "POST",
        headers: { "Idempotency-Key": key.current },
        body: JSON.stringify({
          recipientUserId: recipient?.userId,
          amount,
          note,
        }),
      });
      if (t.status === "OTP_REQUIRED") {
        setPending(t);
        if (t.otpId && t.resendAvailableAt && t.expiresAt)
          setOtp({
            otpId: t.otpId,
            resendAvailableAt: t.resendAvailableAt,
            expiresAt: t.expiresAt,
          });
        return;
      }
      await client.invalidateQueries({ queryKey: ["wallet"] });
      navigate(`/wallet/receipt/${t.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfer failed.");
    }
  }
  async function confirm() {
    try {
      const t = await request<Transfer>(`/transfers/${pending?.id}/confirm`, {
        method: "POST",
        headers: { "Idempotency-Key": confirmKey.current },
        body: JSON.stringify({ otpId: otp?.otpId ?? pending?.otpId, code }),
      });
      await client.invalidateQueries({ queryKey: ["wallet"] });
      navigate(`/wallet/receipt/${t.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    }
  }
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold">Send money</h1>
      <ol
        aria-label="Transfer progress"
        className="my-5 grid grid-cols-3 gap-2"
      >
        {["Recipient", "Amount", "Review"].map((label, index) => (
          <li
            key={label}
            aria-current={step === index + 1 ? "step" : undefined}
            className={`border-t-2 pt-2 text-sm ${step === index + 1 ? "border-primary font-semibold text-foreground" : step > index + 1 ? "border-status-completed text-status-completed" : "border-border text-muted-foreground"}`}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>
      {step === 1 ? (
        <>
          <label className="block text-sm">
            Recipient phone
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-1 min-h-11 w-full rounded border border-border bg-background p-3 text-base"
            />
          </label>
          <Button className="mt-3" onClick={() => lookup.mutate()}>
            Find recipient
          </Button>
          <section className="mt-6">
            <h2 className="font-semibold">Recent contacts</h2>
            {contacts.isLoading ? (
              <p role="status" className="mt-2 text-sm">
                Loading recent contacts…
              </p>
            ) : contacts.isError ? (
              <Failure
                error={contacts.error}
                retry={() => void contacts.refetch()}
              />
            ) : contacts.data?.length ? (
              <ul className="mt-2 divide-y divide-border">
                {contacts.data.map((c) => (
                  <li key={c.userId}>
                    <button
                      className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left hover:bg-muted"
                      onClick={() => {
                        key.current = crypto.randomUUID();
                        setRecipient(c);
                        setStep(2);
                      }}
                    >
                      <span className="font-medium">{c.maskedName}</span>
                      <span className="text-sm text-muted-foreground">
                        {c.maskedPhone}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Your recent recipients will appear here after a transfer.
              </p>
            )}
          </section>
          {recipient && (
            <div className="mt-5">
              <p>
                {recipient.maskedName} · {recipient.maskedPhone}
              </p>
              <Button className="mt-3" onClick={() => setStep(2)}>
                Continue
              </Button>
            </div>
          )}
        </>
      ) : step === 2 ? (
        <>
          <p className="mb-4 rounded bg-muted p-3 text-sm">
            Sending to <strong>{recipient?.maskedName}</strong> ·{" "}
            {recipient?.maskedPhone}
          </p>
          <AmountInput
            value={amount}
            onChange={(v) => {
              setAmount(v);
              key.current = crypto.randomUUID();
            }}
          />
          <div
            className="mt-3 flex flex-wrap gap-2"
            aria-label="Amount presets"
          >
            {["50000", "100000", "200000", "500000"].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setAmount(value);
                  key.current = crypto.randomUUID();
                }}
                className="min-h-11 rounded border border-border px-3 text-sm hover:bg-muted"
              >
                <Money amount={value} />
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm">
            Available:{" "}
            {wallet.data && <Money amount={wallet.data.availableBalance} />} ·
            Monthly limit left:{" "}
            {wallet.data && (
              <Money
                amount={new Big(wallet.data.limits.monthlyOutflow)
                  .minus(wallet.data.limits.monthlyOutflowUsed)
                  .toFixed()}
              />
            )}
          </p>
          <label className="mt-4 block text-sm">
            Note
            <input
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                key.current = crypto.randomUUID();
              }}
              className="mt-1 min-h-11 w-full rounded border border-border bg-background p-3 text-base"
            />
          </label>
          <Button className="mt-4" onClick={() => setStep(3)}>
            Review transfer
          </Button>
        </>
      ) : (
        <>
          <section className="space-y-3 border-y border-border py-4">
            <h2 className="font-semibold">Review transfer</h2>
            <p>
              To: <strong>{recipient?.maskedName}</strong> ·{" "}
              {recipient?.maskedPhone}
            </p>
            <p>
              Amount: <Money amount={amount || "0"} />
            </p>
            <p>Note: {note.trim() || "No note"}</p>
            <p>
              Fee: <Money amount="0" />
            </p>
            {wallet.data && amount && (
              <p>
                Balance after:{" "}
                <Money
                  amount={new Big(wallet.data.availableBalance)
                    .minus(amount)
                    .toFixed()}
                />
              </p>
            )}
          </section>
          {pending ? (
            <>
              {otp && (
                <OtpChallenge
                  challenge={otp}
                  code={code}
                  onCodeChange={setCode}
                  onExpired={() => {
                    setPending(null);
                    setOtp(null);
                    setCode("");
                    setStep(2);
                    setError("Verification expired. Review and send again.");
                  }}
                  onChange={(next) => {
                    setOtp(next);
                    setPending((current) =>
                      current ? { ...current, otpId: next.otpId } : current,
                    );
                    setCode("");
                  }}
                />
              )}
              <Button className="mt-4" onClick={() => void confirm()}>
                Confirm code
              </Button>
            </>
          ) : (
            <Button onClick={() => void send()}>Send money</Button>
          )}
        </>
      )}
      {step > 1 && !pending && (
        <button
          className="mt-4 block text-primary"
          onClick={() => setStep(step - 1)}
        >
          Back
        </button>
      )}
      {error && (
        <p role="alert" className="mt-4 text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
