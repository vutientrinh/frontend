import { Link } from "react-router-dom";
import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleX, Landmark } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  ErrorState,
  Money,
  PageHeader,
  StatusBadge,
} from "../../components/shared";
import { request } from "./client";

type BankAccount = {
  id: string;
  accountNo: string;
  ownerName: string;
  balance: string;
};
type FailureConfig = {
  delayMs: number;
  declineRate: number;
  duplicateCallback: boolean;
};
type TransferResult = {
  id: string;
  status: string;
  reference: string;
  amount?: string;
};

function AmountField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      Amount (VND)
      <input
        required
        inputMode="numeric"
        value={value.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
        className="mt-1 min-h-11 w-full rounded border border-border bg-background p-3 text-base tabular-nums"
      />
    </label>
  );
}

export default function BankConsole({
  page,
}: {
  page: "accounts" | "transfer" | "failures";
}) {
  const client = useQueryClient();
  const accounts = useQuery({
    queryKey: ["bank-sim", "accounts"],
    queryFn: () => request<BankAccount[]>("/bank-sim/accounts"),
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [destinationType, setDestinationType] = useState<
    "reference" | "account"
  >("reference");
  const [destination, setDestination] = useState("");
  const [depositAccount, setDepositAccount] = useState("");
  const [config, setConfig] = useState<FailureConfig>({
    delayMs: 0,
    declineRate: 0,
    duplicateCallback: false,
  });
  const [configDirty, setConfigDirty] = useState(false);
  const key = useRef(crypto.randomUUID());
  const failureSettings = useQuery({
    queryKey: ["bank-sim", "failure-config"],
    queryFn: () => request<FailureConfig>("/bank-sim/failure-config"),
    enabled: page === "failures",
  });
  const transferHistory = useQuery({
    queryKey: ["bank-sim", "transfers"],
    queryFn: () => request<TransferResult[]>("/bank-sim/transfers"),
    enabled: page === "accounts",
  });
  const create = useMutation({
    mutationFn: (owner: string) =>
      request<BankAccount>("/bank-sim/accounts", {
        method: "POST",
        body: JSON.stringify({ ownerName: owner }),
      }),
    onSuccess: () => {
      setOwnerName("");
      void client.invalidateQueries({ queryKey: ["bank-sim", "accounts"] });
      setMessage("Bank account created.");
    },
    onError: (e: Error) => setError(e.message),
  });
  const deposit = useMutation({
    mutationFn: ({
      id,
      value,
      requestKey,
    }: {
      id: string;
      value: string;
      requestKey: string;
    }) =>
      request<BankAccount>(`/bank-sim/accounts/${id}/deposit`, {
        method: "POST",
        headers: { "Idempotency-Key": requestKey },
        body: JSON.stringify({ amount: value }),
      }),
    onSuccess: () => {
      setAmount("");
      setDepositAccount("");
      void client.invalidateQueries({ queryKey: ["bank-sim", "accounts"] });
      setMessage("Cash deposit added to the simulator account.");
      key.current = crypto.randomUUID();
    },
    onError: (e: Error) => setError(e.message),
  });
  const makeTransfer = useMutation({
    mutationFn: () =>
      request<TransferResult>("/bank-sim/transfers", {
        method: "POST",
        headers: { "Idempotency-Key": key.current },
        body: JSON.stringify({
          fromAccountId,
          amount,
          ...(destinationType === "reference"
            ? { toReference: destination.trim() }
            : { toAccountNo: destination.trim() }),
        }),
      }),
    onSuccess: (result) => {
      setError("");
      setMessage(
        result.status === "PROCESSING"
          ? `Transfer accepted. Callback ${result.id} is waiting for the configured delay.`
          : `Transfer sent. Bank reference ${result.id}.`,
      );
      void client.invalidateQueries({ queryKey: ["bank-sim"] });
      void client.invalidateQueries({ queryKey: ["wallet"] });
      key.current = crypto.randomUUID();
    },
    onError: (e: Error) => setError(e.message),
  });
  const saveConfig = useMutation({
    mutationFn: (nextConfig: FailureConfig) =>
      request<FailureConfig>("/bank-sim/failure-config", {
        method: "PUT",
        body: JSON.stringify(nextConfig),
      }),
    onSuccess: (result) => {
      setConfig(result);
      setConfigDirty(false);
      setMessage("Failure settings saved.");
      void client.invalidateQueries({
        queryKey: ["bank-sim", "failure-config"],
      });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (accounts.isError)
    return (
      <ErrorState
        message={accounts.error.message}
        retry={() => void accounts.refetch()}
      />
    );
  const displayedConfig = configDirty
    ? config
    : (failureSettings.data ?? config);
  const accountList = accounts.data ?? [];
  return (
    <div className="space-y-8">
      {page === "accounts" && (
        <>
          <PageHeader
            title="Accounts"
            description="Simulated bank accounts and their available balances."
          />
          <section className="grid gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
            <div className="min-w-0">
              {accounts.isLoading ? (
                <p role="status">Loading bank accounts…</p>
              ) : accountList.length ? (
                <div className="overflow-x-auto rounded-md border border-border bg-background">
                  <table className="w-full min-w-[540px] text-left text-sm">
                    <thead className="bg-muted text-muted-foreground">
                      <tr>
                        <th className="p-3">Account</th>
                        <th className="p-3">Holder</th>
                        <th className="p-3 text-right">Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountList.map((account) => (
                        <tr key={account.id} className="border-t border-border">
                          <td className="p-3 font-mono">{account.accountNo}</td>
                          <td className="p-3">{account.ownerName}</td>
                          <td className="p-3 text-right">
                            <Money amount={account.balance} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No bank accounts yet. Create an account to continue.</p>
              )}
              <form
                className="mt-5 flex flex-wrap items-end gap-3"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  setError("");
                  create.mutate(ownerName.trim());
                }}
              >
                <label className="min-w-52 flex-1 text-sm">
                  Account holder
                  <input
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                    required
                    maxLength={80}
                    className="mt-1 min-h-11 w-full rounded border border-border bg-background p-3 text-base"
                  />
                </label>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Creating…" : "Create account"}
                </Button>
              </form>
            </div>
            <section className="border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
              <h2 className="font-semibold">Deposit simulator cash</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This adds test funds to a bank account; no wallet is credited.
              </p>
              <form
                className="mt-4 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setError("");
                  deposit.mutate({
                    id: depositAccount,
                    value: amount,
                    requestKey: key.current,
                  });
                }}
              >
                <label className="block text-sm">
                  Account
                  <select
                    required
                    value={depositAccount}
                    onChange={(event) => setDepositAccount(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded border border-border bg-background p-3"
                  >
                    <option value="">Select an account</option>
                    {accountList.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.accountNo} · {account.ownerName}
                      </option>
                    ))}
                  </select>
                </label>
                <AmountField
                  value={amount}
                  onChange={(value) => {
                    setAmount(value);
                    key.current = crypto.randomUUID();
                  }}
                />
                <Button
                  type="submit"
                  disabled={deposit.isPending || accounts.isLoading}
                >
                  {deposit.isPending ? "Depositing…" : "Deposit cash"}
                </Button>
              </form>
            </section>
          </section>
          <section className="border-t border-border pt-6">
            <h2 className="font-semibold">Recent simulator transfers</h2>
            {transferHistory.isLoading ? (
              <p role="status" className="mt-3">
                Loading transfers…
              </p>
            ) : transferHistory.isError ? (
              <ErrorState
                message={transferHistory.error.message}
                retry={() => void transferHistory.refetch()}
              />
            ) : transferHistory.data?.length ? (
              <ul className="mt-3 divide-y divide-border">
                {transferHistory.data.slice(0, 6).map((transfer) => (
                  <li
                    key={transfer.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                  >
                    <span>
                      <span className="font-mono">
                        {transfer.id.slice(0, 8)}
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        to {transfer.reference || "bank account"}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <StatusBadge status={transfer.status} />
                      <Money amount={transfer.amount ?? "0"} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No transfers yet. Use Make a transfer when a top-up is pending.
              </p>
            )}
          </section>
        </>
      )}
      {page === "transfer" && (
        <>
          <PageHeader
            title="Make a transfer"
            description="Pay a pending wallet top-up or move simulator funds to another bank account."
          />
          {accounts.isLoading ? (
            <p role="status">Loading accounts…</p>
          ) : (
            <form
              className="grid max-w-3xl gap-5 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                setError("");
                makeTransfer.mutate();
              }}
            >
              <label className="text-sm">
                From account
                <select
                  required
                  value={fromAccountId}
                  onChange={(event) => {
                    setFromAccountId(event.target.value);
                    key.current = crypto.randomUUID();
                  }}
                  className="mt-1 min-h-11 w-full rounded border border-border bg-background p-3"
                >
                  <option value="">Select a bank account</option>
                  {accountList.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountNo} · {account.ownerName}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="text-sm sm:col-span-2">
                <legend className="mb-2 font-medium">Send to</legend>
                <div className="flex flex-wrap gap-4">
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="radio"
                      checked={destinationType === "reference"}
                      onChange={() => {
                        setDestinationType("reference");
                        key.current = crypto.randomUUID();
                      }}
                    />
                    Top-up reference
                  </label>
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="radio"
                      checked={destinationType === "account"}
                      onChange={() => {
                        setDestinationType("account");
                        key.current = crypto.randomUUID();
                      }}
                    />
                    Bank account
                  </label>
                </div>
              </fieldset>
              <label className="text-sm sm:col-span-2">
                {destinationType === "reference"
                  ? "Top-up reference"
                  : "Destination account number"}
                <input
                  required
                  value={destination}
                  onChange={(event) => {
                    setDestination(event.target.value);
                    key.current = crypto.randomUUID();
                  }}
                  autoComplete="off"
                  className="mt-1 min-h-11 w-full rounded border border-border bg-background p-3 text-base"
                />
                {destinationType === "reference" && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Copy this from the shopper’s pending top-up screen.
                  </span>
                )}
              </label>
              <AmountField
                value={amount}
                onChange={(value) => {
                  setAmount(value);
                  key.current = crypto.randomUUID();
                }}
              />
              <div className="flex flex-wrap items-end gap-2">
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
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  disabled={makeTransfer.isPending || accounts.isLoading}
                >
                  {makeTransfer.isPending ? "Sending…" : "Send bank transfer"}
                </Button>
              </div>
            </form>
          )}
          {message && (
            <p
              role="status"
              className="mt-5 flex items-start gap-2 border-l-2 border-status-completed pl-3 text-sm"
            >
              <CircleCheck size={18} className="text-status-completed" />
              {message}
            </p>
          )}
          <Link className="mt-3 inline-block text-primary" to="/wallet">
            Back to wallet
          </Link>
        </>
      )}
      {page === "failures" && (
        <>
          <PageHeader
            title="Failure settings"
            description="Change how the simulator delivers bank callbacks to the payment app."
          />
          {failureSettings.isLoading ? (
            <p role="status">Loading failure settings…</p>
          ) : failureSettings.isError ? (
            <ErrorState
              message={failureSettings.error.message}
              retry={() => void failureSettings.refetch()}
            />
          ) : (
            <form
              className="max-w-2xl space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                setError("");
                saveConfig.mutate(displayedConfig);
              }}
            >
              <label className="block text-sm">
                Callback delay (seconds)
                <input
                  type="number"
                  min="0"
                  max="300"
                  step="1"
                  value={Math.floor(displayedConfig.delayMs / 1000)}
                  onChange={(event) => {
                    setConfigDirty(true);
                    setConfig({
                      ...config,
                      delayMs: Number(event.target.value) * 1000,
                    });
                  }}
                  className="mt-1 min-h-11 w-full rounded border border-border bg-background p-3 text-base"
                />
              </label>
              <label className="block text-sm">
                Decline rate (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={displayedConfig.declineRate}
                  onChange={(event) => {
                    setConfigDirty(true);
                    setConfig({
                      ...config,
                      declineRate: Number(event.target.value),
                    });
                  }}
                  className="mt-1 min-h-11 w-full rounded border border-border bg-background p-3 text-base"
                />
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={displayedConfig.duplicateCallback}
                  onChange={(event) => {
                    setConfigDirty(true);
                    setConfig({
                      ...config,
                      duplicateCallback: event.target.checked,
                    });
                  }}
                />
                Send duplicate callbacks
              </label>
              <p className="border-l-2 border-status-processing pl-3 text-sm text-muted-foreground">
                Duplicate notifications with the same bank reference are
                deduplicated; one top-up credit and journal entry is posted.
              </p>
              <Button type="submit" disabled={saveConfig.isPending}>
                {saveConfig.isPending ? "Saving…" : "Save failure settings"}
              </Button>
            </form>
          )}
        </>
      )}
      {page === "failures" && message && (
        <p role="status" className="mt-4 text-sm text-status-completed">
          {message}
        </p>
      )}
      {page === "accounts" && message && (
        <p role="status" className="mt-4 text-sm text-status-completed">
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 flex items-center gap-2 text-sm text-destructive"
        >
          <CircleX size={16} />
          {error}
        </p>
      )}
      {page === "transfer" && (
        <p className="mt-8 flex items-start gap-2 text-sm text-muted-foreground">
          <Landmark size={18} />A bank transfer moves funds from the selected
          simulated bank account. Wallet funds change only when the platform
          receives the callback.
        </p>
      )}
    </div>
  );
}
