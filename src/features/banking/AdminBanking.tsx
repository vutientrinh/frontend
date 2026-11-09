import { useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck } from "lucide-react";
import Big from "big.js";
import { Button } from "../../components/ui/button";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
  StatusBadge,
} from "../../components/shared";
import { request } from "./client";
import type { Transaction } from "./types";

type WalletRow = {
  id: string;
  ownerName: string;
  phone: string;
  ownerType: string;
  status: string;
  kycTier: number;
  ledgerBalance: string;
  heldAmount: string;
  availableBalance: string;
  limits: {
    maxBalance: string;
    perTransaction: string;
    monthlyOutflow: string;
    monthlyOutflowUsed: string;
  };
};
type OperationRow = {
  id: string;
  type: string;
  status: string;
  reference?: string;
  bankRef?: string;
  amount: string;
  createdAt: string;
  ownerId?: string;
};
type AccountRow = {
  code: string;
  name: string;
  type: string;
  balance: string;
  debit: string;
  credit: string;
};
type Journal = {
  id: string;
  reference: string;
  bankRef?: string;
  createdAt: string;
  lines: { account: string; debit: string; credit: string }[];
};
type AuditRow = {
  id: string;
  actor: string;
  action: string;
  subject: string;
  before: unknown;
  after: unknown;
  createdAt: string;
};
type Settings = {
  tier1MaxBalance: string;
  tier1PerTransaction: string;
  tier1MonthlyOutflow: string;
  tier2MaxBalance: string;
  tier2PerTransaction: string;
  tier2MonthlyOutflow: string;
  otpThreshold: string;
  topUpTtlMinutes: number;
};
type TrialBalance = { debits: string; credits: string; difference: string };

function journalAmount(entry: Journal) {
  return entry.lines
    .reduce((total, line) => total.plus(line.debit), new Big(0))
    .toFixed(0);
}
function queryString(params: URLSearchParams) {
  return params.toString() ? `?${params.toString()}` : "";
}
function useBankingQuery<T>(key: string, path: string, enabled = true) {
  return useQuery({
    queryKey: ["admin-banking", key, path],
    queryFn: () => request<T>(path),
    enabled,
  });
}
function InlineLoading({ label }: { label: string }) {
  return (
    <p role="status" className="py-6">
      Loading {label}…
    </p>
  );
}
function NoRows({ title, clear }: { title: string; clear?: () => void }) {
  return (
    <EmptyState
      title={title}
      description="Try another filter or clear the current search."
      action={
        clear ? (
          <Button className="mt-3" onClick={clear}>
            Clear filters
          </Button>
        ) : undefined
      }
    />
  );
}
function FilterInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 min-h-11 w-full rounded border border-border bg-background p-3 text-base sm:w-64"
      />
    </label>
  );
}

export default function AdminBanking({
  page,
}: {
  page:
    | "wallets"
    | "wallet-detail"
    | "operations"
    | "ledger"
    | "journal-detail"
    | "audit";
}) {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const query = queryString(params);
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<"freeze" | "unfreeze" | null>(null);
  const wallets = useBankingQuery<WalletRow[]>(
    "wallets",
    `/admin/wallets${page === "wallets" ? query : ""}`,
    page === "wallets",
  );
  const wallet = useBankingQuery<WalletRow & { transactions: Transaction[] }>(
    "wallet-detail",
    `/admin/wallets/${id}`,
    page === "wallet-detail",
  );
  const operations = useBankingQuery<OperationRow[]>(
    "operations",
    `/admin/wallet-operations${page === "operations" ? query : ""}`,
    page === "operations",
  );
  const accounts = useBankingQuery<AccountRow[]>(
    "accounts",
    "/admin/ledger/accounts",
    page === "ledger",
  );
  const journals = useBankingQuery<Journal[]>(
    "journals",
    `/admin/ledger/journals${page === "ledger" ? query : ""}`,
    page === "ledger",
  );
  const trial = useBankingQuery<TrialBalance>(
    "trial-balance",
    "/admin/ledger/trial-balance",
    page === "ledger",
  );
  const journal = useBankingQuery<Journal>(
    "journal-detail",
    `/admin/ledger/journals/${id}`,
    page === "journal-detail",
  );
  const auditRows = useBankingQuery<AuditRow[]>(
    "audit",
    `/admin/audit-logs${page === "audit" ? query : ""}`,
    page === "audit",
  );
  const freezeWallet = useMutation({
    mutationFn: () =>
      request(`/admin/wallets/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      }),
    onSuccess: () => {
      setReason("");
      setAction(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-banking"] });
    },
  });
  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next);
  }
  function clearFilters() {
    setParams(new URLSearchParams());
  }

  if (page === "wallets")
    return (
      <div>
        <PageHeader
          title="Wallets"
          description="Shopper balances, limits and wallet state."
        />
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <FilterInput
            label="Search wallets"
            value={params.get("q") ?? ""}
            onChange={(value) => setFilter("q", value)}
            placeholder="Name or masked phone"
          />
          <label className="block text-sm">
            Status
            <select
              value={params.get("status") ?? ""}
              onChange={(event) => setFilter("status", event.target.value)}
              className="mt-1 min-h-11 rounded border border-border bg-background px-3"
            >
              <option value="">All wallets</option>
              <option value="ACTIVE">Active</option>
              <option value="FROZEN">Frozen</option>
            </select>
          </label>
        </div>
        {wallets.isLoading ? (
          <InlineLoading label="wallets" />
        ) : wallets.isError ? (
          <ErrorState
            message={wallets.error.message}
            retry={() => void wallets.refetch()}
          />
        ) : !wallets.data?.length ? (
          <NoRows
            title={
              params.size
                ? "No wallets match these filters"
                : "No wallets found"
            }
            clear={params.size ? clearFilters : undefined}
          />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 bg-muted text-muted-foreground">
                <tr>
                  <th className="p-3">Wallet owner</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Tier</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ledger balance</th>
                  <th className="p-3 text-right">Held</th>
                </tr>
              </thead>
              <tbody>
                {wallets.data.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-border hover:bg-muted/60"
                  >
                    <td className="p-3">
                      <Link
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        to={`/admin/wallets/${row.id}`}
                      >
                        {row.ownerName}
                      </Link>
                    </td>
                    <td className="p-3">{row.phone}</td>
                    <td className="p-3">Tier {row.kycTier}</td>
                    <td className="p-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="p-3 text-right">
                      <Money amount={row.ledgerBalance} />
                    </td>
                    <td className="p-3 text-right">
                      <Money amount={row.heldAmount} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );

  if (page === "wallet-detail")
    return (
      <div>
        <Link to="/admin/wallets" className="text-sm text-primary">
          ← Wallets
        </Link>
        {wallet.isLoading ? (
          <InlineLoading label="wallet" />
        ) : wallet.isError ? (
          <ErrorState
            message={wallet.error.message}
            retry={() => void wallet.refetch()}
          />
        ) : (
          <>
            <PageHeader
              title={wallet.data!.ownerName}
              description={`${wallet.data!.phone} · Tier ${wallet.data!.kycTier} wallet`}
              action={<StatusBadge status={wallet.data!.status} />}
            />
            <section className="grid gap-5 border-y border-border py-5 sm:grid-cols-3">
              <p>
                <span className="block text-sm text-muted-foreground">
                  Ledger balance
                </span>
                <strong className="text-xl">
                  <Money amount={wallet.data!.ledgerBalance} />
                </strong>
              </p>
              <p>
                <span className="block text-sm text-muted-foreground">
                  Held
                </span>
                <strong className="text-xl">
                  <Money amount={wallet.data!.heldAmount} />
                </strong>
              </p>
              <p>
                <span className="block text-sm text-muted-foreground">
                  Available
                </span>
                <strong className="text-xl">
                  <Money amount={wallet.data!.availableBalance} />
                </strong>
              </p>
            </section>
            <section className="mt-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-semibold">Wallet controls</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Freeze blocks incoming and outgoing wallet activity.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-sm">
                  Reason
                  <input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    minLength={3}
                    className="mt-1 min-h-11 rounded border border-border bg-background p-3 text-base"
                  />
                </label>
                <Button
                  disabled={reason.trim().length < 3 || freezeWallet.isPending}
                  className={
                    wallet.data!.status === "FROZEN"
                      ? "border border-border bg-background text-foreground"
                      : "bg-destructive text-background"
                  }
                  onClick={() =>
                    setAction(
                      wallet.data!.status === "FROZEN" ? "unfreeze" : "freeze",
                    )
                  }
                >
                  {wallet.data!.status === "FROZEN"
                    ? "Unfreeze wallet"
                    : "Freeze wallet"}
                </Button>
              </div>
            </section>
            {freezeWallet.isError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {freezeWallet.error.message}
              </p>
            )}
            <section className="mt-8">
              <h2 className="font-semibold">Recent activity</h2>
              {wallet.data!.transactions.length ? (
                <ul className="mt-2 divide-y divide-border">
                  {wallet.data!.transactions.map((tx) => (
                    <li
                      key={tx.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <span>
                        {tx.type === "TOP_UP"
                          ? "Top-up"
                          : tx.type === "TRANSFER_OUT"
                            ? `Sent to ${tx.counterparty?.fullName ?? tx.counterparty?.maskedName ?? "recipient"}`
                            : `Received from ${tx.counterparty?.fullName ?? tx.counterparty?.maskedName ?? "sender"}`}
                        <span className="block text-sm text-muted-foreground">
                          {tx.reference} ·{" "}
                          {new Date(tx.createdAt).toLocaleString()}
                        </span>
                      </span>
                      <span
                        className={
                          tx.direction === "IN"
                            ? "text-status-completed"
                            : "text-destructive"
                        }
                      >
                        {tx.direction === "IN" ? "+" : "−"}
                        <Money amount={tx.amount} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  No wallet activity yet.
                </p>
              )}
            </section>
            <ConfirmDialog
              open={!!action}
              onOpenChange={(open) => {
                if (!open) setAction(null);
              }}
              title={
                action === "freeze"
                  ? `Freeze ${wallet.data!.ownerName}’s wallet?`
                  : `Unfreeze ${wallet.data!.ownerName}’s wallet?`
              }
              description={
                action === "freeze"
                  ? `This blocks new wallet activity. Reason: ${reason}`
                  : `This restores wallet activity. Reason: ${reason}`
              }
              onConfirm={() => freezeWallet.mutate()}
            />
          </>
        )}
      </div>
    );

  if (page === "operations")
    return (
      <div>
        <PageHeader
          title="Top-ups & transfers"
          description="Trace bank confirmations, wallet transfers and suspense items."
        />
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <FilterInput
            label="Search reference"
            value={params.get("q") ?? ""}
            onChange={(value) => setFilter("q", value)}
            placeholder="Reference or bank ID"
          />
          <label className="block text-sm">
            Type
            <select
              value={params.get("type") ?? ""}
              onChange={(event) => setFilter("type", event.target.value)}
              className="mt-1 min-h-11 rounded border border-border bg-background px-3"
            >
              <option value="">All activity</option>
              <option value="TOP_UP">Top-ups</option>
              <option value="TRANSFER">Transfers</option>
              <option value="SUSPENSE">Suspense</option>
            </select>
          </label>
          <label className="block text-sm">
            Status
            <select
              value={params.get("status") ?? ""}
              onChange={(event) => setFilter("status", event.target.value)}
              className="mt-1 min-h-11 rounded border border-border bg-background px-3"
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Completed</option>
              <option value="SUSPENSE">Needs review</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </label>
        </div>
        {operations.isLoading ? (
          <InlineLoading label="wallet operations" />
        ) : operations.isError ? (
          <ErrorState
            message={operations.error.message}
            retry={() => void operations.refetch()}
          />
        ) : !operations.data?.length ? (
          <NoRows
            title={
              params.size
                ? "No operations match these filters"
                : "No wallet operations yet"
            }
            clear={params.size ? clearFilters : undefined}
          />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="p-3">Reference</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3">Received</th>
                </tr>
              </thead>
              <tbody>
                {operations.data.map((row) => (
                  <tr
                    key={`${row.type}-${row.id}`}
                    className={`border-t border-border ${row.type === "SUSPENSE" ? "bg-status-pending/10" : ""}`}
                  >
                    <td className="p-3 font-mono">
                      {row.reference ?? row.bankRef ?? row.id.slice(0, 12)}
                    </td>
                    <td className="p-3">
                      {row.type === "TOP_UP"
                        ? "Top-up"
                        : row.type === "TRANSFER"
                          ? "Wallet transfer"
                          : "Suspense · unmatched transfer"}
                    </td>
                    <td className="p-3">
                      {row.status === "SUSPENSE" ? (
                        <span className="inline-flex items-center gap-1 text-status-pending">
                          <CircleAlert size={15} />
                          Needs review
                        </span>
                      ) : (
                        <StatusBadge status={row.status} />
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Money amount={row.amount} />
                    </td>
                    <td className="p-3">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );

  if (page === "ledger")
    return (
      <div>
        <PageHeader
          title="Ledger explorer"
          description="Account balances, immutable journal entries and trace by reference."
        />
        {trial.isLoading ? (
          <InlineLoading label="trial balance" />
        ) : trial.isError ? (
          <ErrorState
            message={trial.error.message}
            retry={() => void trial.refetch()}
          />
        ) : (
          <section
            className={`mb-6 flex flex-wrap items-center justify-between gap-3 border-l-4 p-4 ${new Big(trial.data!.difference).eq(0) ? "border-status-completed bg-muted" : "border-destructive bg-muted"}`}
          >
            <span className="flex items-center gap-2 font-semibold">
              {new Big(trial.data!.difference).eq(0) ? (
                <CircleCheck size={20} className="text-status-completed" />
              ) : (
                <CircleAlert size={20} className="text-destructive" />
              )}
              {new Big(trial.data!.difference).eq(0)
                ? "Trial balance is balanced"
                : "Trial balance difference found"}
            </span>
            <span className="text-sm">
              Debits <Money amount={trial.data!.debits} /> · Credits{" "}
              <Money amount={trial.data!.credits} /> · Difference{" "}
              <Money amount={trial.data!.difference} />
            </span>
          </section>
        )}
        <section>
          <h2 className="mb-3 font-semibold">Chart of accounts</h2>
          {accounts.isLoading ? (
            <InlineLoading label="accounts" />
          ) : accounts.isError ? (
            <ErrorState
              message={accounts.error.message}
              retry={() => void accounts.refetch()}
            />
          ) : accounts.data?.length ? (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="p-3">Code</th>
                    <th className="p-3">Account</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.data.map((account) => (
                    <tr key={account.code} className="border-t border-border">
                      <td className="p-3 font-mono">{account.code}</td>
                      <td className="p-3">{account.name}</td>
                      <td className="p-3">
                        {account.type === "ASSET" ? "Asset" : "Liability"}
                      </td>
                      <td className="p-3 text-right">
                        <Money amount={account.balance} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <NoRows title="No ledger accounts" />
          )}
        </section>
        <section className="mt-8">
          <h2 className="mb-3 font-semibold">Journal entries</h2>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            {[
              ["reference", "Reference"],
              ["accountCode", "Account code"],
              ["from", "From date"],
              ["to", "To date"],
            ].map(([key, label]) => (
              <label key={key} className="text-sm">
                {label}
                <input
                  type={key === "from" || key === "to" ? "date" : "text"}
                  value={params.get(key) ?? ""}
                  onChange={(event) => setFilter(key, event.target.value)}
                  className="mt-1 min-h-11 w-full rounded border border-border bg-background p-3 text-base"
                />
              </label>
            ))}
          </div>
          {journals.isLoading ? (
            <InlineLoading label="journal entries" />
          ) : journals.isError ? (
            <ErrorState
              message={journals.error.message}
              retry={() => void journals.refetch()}
            />
          ) : journals.data?.length ? (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="p-3">Reference</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3">Journal ID</th>
                    <th className="p-3">Accounts</th>
                    <th className="p-3">Posted</th>
                  </tr>
                </thead>
                <tbody>
                  {journals.data.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-t border-border hover:bg-muted/60"
                    >
                      <td className="p-3 font-mono">
                        {entry.reference}
                        {entry.bankRef && (
                          <span className="block font-sans text-xs text-muted-foreground">
                            Bank ref: {entry.bankRef}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        <Money amount={journalAmount(entry)} />
                      </td>
                      <td className="p-3">
                        <Link
                          className="text-primary underline-offset-4 hover:underline"
                          to={`/admin/ledger/journals/${entry.id}`}
                        >
                          {entry.id.slice(0, 12)}
                        </Link>
                      </td>
                      <td className="p-3">
                        {entry.lines.map((line) => line.account).join(", ")}
                      </td>
                      <td className="p-3">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <NoRows
              title={
                params.size
                  ? "No journals match these filters"
                  : "No journals posted"
              }
              clear={params.size ? clearFilters : undefined}
            />
          )}
        </section>
      </div>
    );

  if (page === "journal-detail")
    return (
      <div>
        <Link to="/admin/ledger" className="text-sm text-primary">
          ← Ledger explorer
        </Link>
        {journal.isLoading ? (
          <InlineLoading label="journal" />
        ) : journal.isError ? (
          <ErrorState
            message={journal.error.message}
            retry={() => void journal.refetch()}
          />
        ) : (
          <>
            <PageHeader
              title="Journal entry"
              description={`${journal.data!.reference} · ${new Date(journal.data!.createdAt).toLocaleString()}`}
            />
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3">Account</th>
                    <th className="p-3 text-right">Debit</th>
                    <th className="p-3 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {journal.data!.lines.map((line, index) => (
                    <tr
                      key={`${line.account}-${index}`}
                      className="border-t border-border"
                    >
                      <td className="p-3 font-mono">{line.account}</td>
                      <td className="p-3 text-right">
                        <Money amount={line.debit} />
                      </td>
                      <td className="p-3 text-right">
                        <Money amount={line.credit} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-status-completed">
              <CircleCheck size={16} />
              This journal is immutable and balanced.
            </p>
          </>
        )}
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Staff actions and configuration changes with before/after values."
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {[
          ["actor", "Actor"],
          ["action", "Action"],
          ["from", "From date"],
          ["to", "To date"],
        ].map(([key, label]) => (
          <label key={key} className="text-sm">
            {label}
            <input
              type={key === "from" || key === "to" ? "date" : "search"}
              value={params.get(key) ?? ""}
              onChange={(event) => setFilter(key, event.target.value)}
              className="mt-1 min-h-11 w-full rounded border border-border bg-background p-3 text-base"
            />
          </label>
        ))}
      </div>
      {auditRows.isLoading ? (
        <InlineLoading label="audit entries" />
      ) : auditRows.isError ? (
        <ErrorState
          message={auditRows.error.message}
          retry={() => void auditRows.refetch()}
        />
      ) : auditRows.data?.length ? (
        <div className="space-y-3">
          {auditRows.data.map((entry) => (
            <article
              key={entry.id}
              className="border-l-2 border-border py-2 pl-4"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <strong>
                  {entry.action
                    .replaceAll("_", " ")
                    .toLowerCase()
                    .replace(/^./, (letter) => letter.toUpperCase())}
                </strong>
                <time
                  className="text-sm text-muted-foreground"
                  dateTime={entry.createdAt}
                >
                  {new Date(entry.createdAt).toLocaleString()}
                </time>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {entry.actor} · {entry.subject}
              </p>
              <details className="mt-2 text-sm">
                <summary className="min-h-11 cursor-pointer py-3 text-primary">
                  Before and after
                </summary>
                <pre className="max-w-full overflow-auto rounded bg-muted p-3 text-xs">
                  {JSON.stringify(
                    { before: entry.before, after: entry.after },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </article>
          ))}
        </div>
      ) : (
        <NoRows
          title={
            params.size
              ? "No audit records match these filters"
              : "No staff actions recorded yet"
          }
          clear={params.size ? clearFilters : undefined}
        />
      )}
    </div>
  );
}

export function BankingSettingsPanel() {
  const client = useQueryClient();
  const settings = useBankingQuery<Settings>("settings", "/admin/settings");
  const [message, setMessage] = useState("");
  const mutation = useMutation({
    mutationFn: (value: Settings) =>
      request<Settings>("/admin/settings", {
        method: "PUT",
        body: JSON.stringify(value),
      }),
    onSuccess: (value) => {
      client.setQueryData(
        ["admin-banking", "settings", "/admin/settings"],
        value,
      );
      void client.invalidateQueries({ queryKey: ["admin-banking", "audit"] });
      setMessage("Banking limits saved and audit recorded.");
    },
  });
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutation.mutate({
      tier1MaxBalance: String(form.get("tier1MaxBalance")),
      tier1PerTransaction: String(form.get("tier1PerTransaction")),
      tier1MonthlyOutflow: String(form.get("tier1MonthlyOutflow")),
      tier2MaxBalance: String(form.get("tier2MaxBalance")),
      tier2PerTransaction: String(form.get("tier2PerTransaction")),
      tier2MonthlyOutflow: String(form.get("tier2MonthlyOutflow")),
      otpThreshold: String(form.get("otpThreshold")),
      topUpTtlMinutes: Number(form.get("topUpTtlMinutes")),
    });
  }
  if (settings.isLoading)
    return (
      <section className="border-t border-border py-6">
        <h2 className="font-semibold">Banking limits</h2>
        <InlineLoading label="banking settings" />
      </section>
    );
  if (settings.isError)
    return (
      <section className="border-t border-border py-6">
        <h2 className="font-semibold">Banking limits</h2>
        <ErrorState
          message={settings.error.message}
          retry={() => void settings.refetch()}
        />
      </section>
    );
  const fields: [keyof Settings, string][] = [
    ["tier1MaxBalance", "Tier 1 maximum balance"],
    ["tier1PerTransaction", "Tier 1 per transaction"],
    ["tier1MonthlyOutflow", "Tier 1 monthly outflow"],
    ["tier2MaxBalance", "Tier 2 maximum balance"],
    ["tier2PerTransaction", "Tier 2 per transaction"],
    ["tier2MonthlyOutflow", "Tier 2 monthly outflow"],
    ["otpThreshold", "OTP threshold"],
    ["topUpTtlMinutes", "Top-up expiry (minutes)"],
  ];
  return (
    <section id="banking-limits" className="border-t border-border py-6">
      <PageHeader
        title="Banking limits"
        description="Whole-VND wallet limits and top-up expiry. Changes are recorded in the audit log."
      />
      <form
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={save}
      >
        {fields.map(([key, label]) => (
          <label key={key} className="text-sm">
            {label}
            <input
              required
              name={key}
              type={key === "topUpTtlMinutes" ? "number" : "text"}
              inputMode="numeric"
              pattern={key === "topUpTtlMinutes" ? undefined : "[0-9]+"}
              min="1"
              max={key === "topUpTtlMinutes" ? "120" : undefined}
              defaultValue={settings.data![key]}
              className="mt-1 min-h-11 w-full rounded border border-border bg-background p-3 text-base tabular-nums"
            />
          </label>
        ))}
        <div className="sm:col-span-2 lg:col-span-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save banking limits"}
          </Button>
          {message && (
            <p role="status" className="mt-2 text-sm text-status-completed">
              {message}
            </p>
          )}
          {mutation.isError && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {mutation.error.message}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
