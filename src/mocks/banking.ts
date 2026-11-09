import { http, HttpResponse } from "msw";
import Big from "big.js";
import type {
  Address,
  Recipient,
  Role,
  TopUp,
  Transaction,
  User,
} from "../features/banking/types";
import { SELLER_USER_IDS } from "./commerce/seed";
import {
  getDB as getCommerceDB,
  saveDB as saveCommerceDB,
} from "./commerce/db";
const API = new URL("/api", window.location.origin).href;
type StoredUser = User & { password: string };
type Entry = {
  id: string;
  reference: string;
  bankRef?: string;
  createdAt: string;
  lines: { account: string; debit: string; credit: string }[];
};
type Pending = {
  id: string;
  from: string;
  to: string;
  amount: string;
  note: string;
  otpId: string;
};
type BankingSettings = {
  tier1MaxBalance: string;
  tier1PerTransaction: string;
  tier1MonthlyOutflow: string;
  tier2MaxBalance: string;
  tier2PerTransaction: string;
  tier2MonthlyOutflow: string;
  otpThreshold: string;
  topUpTtlMinutes: number;
};
type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  subject: string;
  before: unknown;
  after: unknown;
  createdAt: string;
};
type BankDB = {
  users: StoredUser[];
  addresses: Record<string, Address[]>;
  journals: Entry[];
  transactions: Record<string, Transaction[]>;
  topups: (TopUp & { owner: string })[];
  pending: Pending[];
  otp: Record<
    string,
    {
      userId: string;
      purpose: string;
      attempts: number;
      lockedUntil: number;
      resendAvailableAt: number;
      expiresAt: number;
    }
  >;
  devices: Record<string, string[]>;
  loginFailures: Record<string, { count: number; lockedUntil: number }>;
  sessions: Record<string, string>;
  refresh: Record<string, string>;
  keys: Record<string, { body: string; result: unknown }>;
  bankAccounts: {
    id: string;
    accountNo: string;
    ownerName: string;
    balance: string;
  }[];
  bankTransfers: {
    id: string;
    fromAccountNo: string;
    to: string;
    amount: string;
    status: string;
    createdAt: string;
  }[];
  frozenWallets: Record<string, string>;
  settings: BankingSettings;
  audit: AuditEntry[];
  callbacks: {
    bankRef: string;
    reference: string;
    amount: string;
    dueAt: number;
    applied: boolean;
  }[];
  failureConfig: {
    delayMs: number;
    declineRate: number;
    duplicateCallback: boolean;
  };
  suspense: {
    bankRef: string;
    reference: string;
    amount: string;
    createdAt: string;
  }[];
};
const key = "payment-banking-mock-v3";
let memory: BankDB | undefined;
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const publicUser = (u: StoredUser): User => ({
  id: u.id,
  phone: u.phone,
  email: u.email,
  fullName: u.fullName,
  roles: u.roles,
  kycTier: u.kycTier,
  status: u.status,
});
function makeUser(
  phone: string,
  fullName: string,
  kycTier: number,
  roles: Role[],
): StoredUser {
  return {
    id: id(),
    phone,
    email: roles.includes("SHOPPER") ? "" : `${phone}@demo.local`,
    fullName,
    kycTier,
    roles,
    status: "ACTIVE",
    password: "demo123",
  };
}
function init(): BankDB {
  const users = [
    makeUser("0900000001", "Nguyễn Minh An", 1, ["SHOPPER"]),
    makeUser("0900000002", "Trần Linh Mai", 1, ["SHOPPER"]),
    makeUser("0900000003", "Alex Nguyen", 1, ["SHOPPER"]),
    makeUser("0900000004", "Lê Thanh", 0, ["SHOPPER"]),
    makeUser("admin", "Admin", 0, ["ADMIN"]),
    makeUser("finance", "Finance", 0, ["FINANCE"]),
    ...SELLER_USER_IDS.map((sellerId, index) => {
      const seller = makeUser(
        `091000000${index + 1}`,
        [
          "Saigon Gadget House",
          "Hanoi Home & Living",
          "Da Nang Outdoor",
          "New seller",
        ][index],
        0,
        ["SELLER_OWNER"],
      );
      seller.id = sellerId;
      return seller;
    }),
  ];
  const db: BankDB = {
    users,
    addresses: {},
    journals: [],
    transactions: {},
    topups: [],
    pending: [],
    otp: {},
    devices: {},
    loginFailures: {},
    sessions: {},
    refresh: {},
    keys: {},
    bankAccounts: users
      .filter((u) => u.roles.includes("SHOPPER"))
      .map((u, index) => ({
        id: u.id,
        accountNo: `97000000000${index + 1}`,
        ownerName: u.fullName,
        balance: "10000000",
      })),
    frozenWallets: {},
    bankTransfers: [],
    settings: {
      tier1MaxBalance: "5000000",
      tier1PerTransaction: "2000000",
      tier1MonthlyOutflow: "20000000",
      tier2MaxBalance: "100000000",
      tier2PerTransaction: "50000000",
      tier2MonthlyOutflow: "100000000",
      otpThreshold: "2000000",
      topUpTtlMinutes: 15,
    },
    audit: [],
    callbacks: [],
    failureConfig: { delayMs: 0, declineRate: 0, duplicateCallback: false },
    suspense: [],
  };
  for (const u of users.slice(0, 3)) {
    const ref = `SEED-${u.phone}`,
      journal = post(db, ref, [
        { account: "1010", debit: "1000000", credit: "0" },
        { account: `2010:${u.id}`, debit: "0", credit: "1000000" },
      ]);
    transaction(db, u.id, "TOP_UP", "IN", "1000000", ref, "", journal.id);
  }
  return db;
}
function get(): BankDB {
  if (memory) return memory;
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const db = JSON.parse(stored) as Partial<BankDB> &
        Pick<BankDB, "users" | "journals">;
      const fresh = init();
      return (memory = {
        ...fresh,
        ...db,
        users: [
          ...(db.users ?? fresh.users),
          ...fresh.users.filter(
            (candidate) =>
              candidate.roles.includes("SELLER_OWNER") &&
              !db.users?.some((storedUser) => storedUser.id === candidate.id),
          ),
        ],
        frozenWallets: db.frozenWallets ?? {},
        bankTransfers: db.bankTransfers ?? [],
        settings: { ...fresh.settings, ...db.settings },
        audit: db.audit ?? [],
        bankAccounts: (db.bankAccounts ?? fresh.bankAccounts).map(
          (account, index) => ({
            ...account,
            accountNo: account.accountNo ?? `97000000000${index + 1}`,
          }),
        ),
      } as BankDB);
    }
  } catch {
    /* use seed */
  }
  return (memory = init());
}
function save() {
  localStorage.setItem(key, JSON.stringify(get()));
}
export function resetBanking() {
  memory = init();
  save();
}
export type WalletChargeResult = { ok: true } | { ok: false; reason: string };

/** Charge a shopper wallet into marketplace escrow once per payment intent. */
export function chargeWalletToEscrow(
  userId: string,
  value: string,
  refs: { intentId: string; parentOrderId: string },
): WalletChargeResult {
  const db = get();
  const reference = `COMMERCE-PAYMENT:${refs.intentId}`;
  if (db.journals.some((journal) => journal.reference === reference))
    return { ok: true };
  const owner = db.users.find((candidate) => candidate.id === userId);
  if (!owner || !owner.roles.includes("SHOPPER") || owner.kycTier < 1)
    return { ok: false, reason: "Shopper wallet not found." };
  if (owner.status !== "ACTIVE" || db.frozenWallets[userId])
    return { ok: false, reason: "Wallet is frozen." };
  if (!amount(value))
    return { ok: false, reason: "Enter a positive whole VND amount." };
  if (balance(db, userId).lt(value))
    return { ok: false, reason: "Insufficient available balance." };
  const walletLimits = limits(db, owner);
  if (new Big(value).gt(walletLimits.perTransaction))
    return { ok: false, reason: "Per-transaction limit exceeded." };
  if (
    new Big(value)
      .plus(walletLimits.monthlyOutflowUsed)
      .gt(walletLimits.monthlyOutflow)
  )
    return { ok: false, reason: "Monthly limit exceeded." };
  const dailyCount = (db.transactions[userId] ?? []).filter(
    (tx) =>
      tx.direction === "OUT" && localDay(tx.createdAt) === localDay(new Date()),
  ).length;
  if (dailyCount >= 20)
    return { ok: false, reason: "Daily outgoing transaction limit exceeded." };
  const journal = post(db, reference, [
    { account: `2010:${userId}`, debit: value, credit: "0" },
    { account: "2030", debit: "0", credit: value },
  ]);
  transaction(
    db,
    userId,
    "PAYMENT",
    "OUT",
    value,
    reference,
    `Marketplace order ${refs.parentOrderId}`,
    journal.id,
  );
  save();
  return { ok: true };
}
function post(
  db: BankDB,
  reference: string,
  lines: Entry["lines"],
  bankRef?: string,
): Entry {
  const debit = lines.reduce((a, l) => a.plus(l.debit), new Big(0)),
    credit = lines.reduce((a, l) => a.plus(l.credit), new Big(0));
  if (!debit.eq(credit)) throw new Error("Unbalanced journal");
  const entry = {
    id: id(),
    reference,
    ...(bankRef ? { bankRef } : {}),
    createdAt: now(),
    lines,
  };
  db.journals.push(entry);
  return entry;
}
function balance(db: BankDB, userId: string) {
  return db.journals
    .flatMap((j) => j.lines)
    .filter((l) => l.account === `2010:${userId}`)
    .reduce((a, l) => a.plus(l.credit).minus(l.debit), new Big(0));
}
function mask(u: StoredUser): Recipient {
  const names = u.fullName.split(" ");
  return {
    userId: u.id,
    maskedName:
      names.length > 1
        ? `${names[0]} ${names
            .slice(1, -1)
            .map((n) => `${n[0]}***`)
            .join(" ")} ${names.at(-1)?.[0] ?? ""}`
            .replace(/\s+/g, " ")
            .trim()
        : `${u.fullName.slice(0, 1)}***`,
    maskedPhone: `${u.phone.slice(0, 2)}******${u.phone.slice(-2)}`,
  };
}
function transaction(
  db: BankDB,
  owner: string,
  type: Transaction["type"],
  direction: Transaction["direction"],
  amount: string,
  reference: string,
  note: string,
  journalId: string,
  counterparty?: Recipient,
): Transaction {
  const tx: Transaction = {
    id: id(),
    type,
    direction,
    status: "COMPLETED",
    amount,
    balanceAfter: balance(db, owner).toFixed(),
    reference,
    note,
    createdAt: now(),
    journalId,
    timeline: [{ status: "COMPLETED", createdAt: now() }],
    ...(counterparty ? { counterparty } : {}),
  };
  (db.transactions[owner] ??= []).unshift(tx);
  return tx;
}
const problem = (status: number, detail: string) =>
  HttpResponse.json(
    { type: "about:blank", title: "Request failed", status, detail },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
const parse = async (request: Request) =>
  (await request.json()) as Record<string, string>;
const user = (request: Request) => {
  const db = get(),
    token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
  return db.users.find((u) => u.id === db.sessions[token ?? ""]);
};
const shopper = (request: Request) => {
  const u = user(request);
  return u?.roles.includes("SHOPPER") ? u : undefined;
};
const staff = (request: Request) => {
  const current = user(request);
  return current?.roles.some((role) =>
    ["ADMIN", "FINANCE", "SUPPORT"].includes(role),
  )
    ? current
    : undefined;
};
const finance = (request: Request) => {
  const current = staff(request);
  return current?.roles.some((role) => ["ADMIN", "FINANCE"].includes(role))
    ? current
    : undefined;
};
function audit(
  db: BankDB,
  actor: StoredUser,
  action: string,
  subject: string,
  before: unknown,
  after: unknown,
) {
  db.audit.unshift({
    id: id(),
    actor: actor.fullName,
    action,
    subject,
    before,
    after,
    createdAt: now(),
  });
}
function tokens(db: BankDB, u: StoredUser) {
  const accessToken = id(),
    refreshToken = id();
  db.sessions[accessToken] = u.id;
  db.refresh[refreshToken] = u.id;
  save();
  return { accessToken, refreshToken, user: publicUser(u) };
}
function otp(db: BankDB, u: StoredUser, purpose: string) {
  const otpId = id();
  const createdAt = Date.now();
  db.otp[otpId] = {
    userId: u.id,
    purpose,
    attempts: 0,
    lockedUntil: 0,
    resendAvailableAt: createdAt + 60000,
    expiresAt: createdAt + 300000,
  };
  save();
  return otpId;
}
const otpResponse = (db: BankDB, otpId: string) => {
  const challenge = db.otp[otpId];
  return HttpResponse.json(
    {
      otpId,
      resendAvailableAt: new Date(challenge.resendAvailableAt).toISOString(),
      expiresAt: new Date(challenge.expiresAt).toISOString(),
    },
    { headers: { "X-Mock-OTP": "123456" } },
  );
};
function verify(db: BankDB, otpId: string, code: string, purpose?: string) {
  const o = db.otp[otpId];
  if (!o || (purpose && o.purpose !== purpose))
    return "Invalid verification request";
  if (o.expiresAt <= Date.now()) return "Code expired. Request a new code.";
  if (o.lockedUntil > Date.now())
    return "Too many attempts. Try again in 15 minutes.";
  if (code !== "123456") {
    o.attempts++;
    if (o.attempts >= 5) {
      o.lockedUntil = Date.now() + 900000;
      o.attempts = 0;
    }
    save();
    return "Incorrect verification code";
  }
  return "";
}
function amount(value: string) {
  return (
    /^\d+$/.test(value ?? "") &&
    new Big(value).gt(0) &&
    new Big(value).lte("9999999999999999999")
  );
}
function once(
  db: BankDB,
  request: Request,
  body: unknown,
  perform: () => unknown,
): Response {
  const token = request.headers.get("Idempotency-Key");
  if (!token) return problem(400, "Idempotency-Key is required");
  const scope = `${user(request)?.id}:${new URL(request.url).pathname}:${token}`,
    value = JSON.stringify(body),
    previous = db.keys[scope];
  if (previous)
    return previous.body === value
      ? HttpResponse.json(
          previous.result as Record<string, string>,
          (previous.result as { status?: string }).status === "OTP_REQUIRED"
            ? { headers: { "X-Mock-OTP": "123456" } }
            : undefined,
        )
      : problem(
          409,
          "This request key was already used with different details.",
        );
  const result = perform();
  if (result instanceof Response) return result;
  db.keys[scope] = { body: value, result };
  save();
  return HttpResponse.json(
    result as Record<string, string>,
    (result as { status?: string }).status === "OTP_REQUIRED"
      ? { headers: { "X-Mock-OTP": "123456" } }
      : undefined,
  );
}
const localDay = (value: string | Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const limits = (db: BankDB, u: StoredUser) => {
  const month = localDay(new Date()).slice(0, 7);
  const used = (db.transactions[u.id] ?? [])
    .filter(
      (t) =>
        t.direction === "OUT" && localDay(t.createdAt).slice(0, 7) === month,
    )
    .reduce((a, t) => a.plus(t.amount), new Big(0));
  return u.kycTier >= 2
    ? {
        maxBalance: db.settings.tier2MaxBalance,
        perTransaction: db.settings.tier2PerTransaction,
        monthlyOutflow: db.settings.tier2MonthlyOutflow,
        monthlyOutflowUsed: used.toFixed(),
      }
    : {
        maxBalance: db.settings.tier1MaxBalance,
        perTransaction: db.settings.tier1PerTransaction,
        monthlyOutflow: db.settings.tier1MonthlyOutflow,
        monthlyOutflowUsed: used.toFixed(),
      };
};
function execute(
  db: BankDB,
  from: StoredUser,
  to: StoredUser,
  v: string,
  note: string,
  reference: string,
) {
  const journal = post(db, reference, [
    { account: `2010:${from.id}`, debit: v, credit: "0" },
    { account: `2010:${to.id}`, debit: "0", credit: v },
  ]);
  const out = transaction(
    db,
    from.id,
    "TRANSFER_OUT",
    "OUT",
    v,
    reference,
    note,
    journal.id,
    mask(to),
  );
  transaction(
    db,
    to.id,
    "TRANSFER_IN",
    "IN",
    v,
    reference,
    note,
    journal.id,
    mask(from),
  );
  return out;
}
function transferError(
  db: BankDB,
  from: StoredUser,
  to: StoredUser | undefined,
  v: string,
) {
  if (from.kycTier < 1) return "Verify your identity to open a wallet.";
  if (!to || to.kycTier < 1) return "Recipient wallet not found.";
  if (from.id === to.id) return "You cannot transfer to yourself.";
  if (
    from.status !== "ACTIVE" ||
    to.status !== "ACTIVE" ||
    db.frozenWallets[from.id] ||
    db.frozenWallets[to.id]
  )
    return "Wallet is frozen.";
  if (!amount(v)) return "Enter a positive whole VND amount.";
  if (balance(db, from.id).lt(v)) return "Insufficient available balance.";
  if (
    (db.transactions[from.id] ?? []).filter(
      (t) =>
        t.direction === "OUT" && localDay(t.createdAt) === localDay(new Date()),
    ).length >= 20
  )
    return "Daily outgoing transaction limit exceeded.";
  if (new Big(v).gt(limits(db, from).perTransaction))
    return "Per-transaction limit exceeded.";
  if (
    new Big(v)
      .plus(limits(db, from).monthlyOutflowUsed)
      .gt(limits(db, from).monthlyOutflow)
  )
    return "Monthly limit exceeded.";
  if (balance(db, to.id).plus(v).gt(limits(db, to).maxBalance))
    return "Recipient balance limit exceeded.";
  return "";
}
function applyBankEvents(db: BankDB) {
  for (const callback of db.callbacks) {
    if (callback.applied || callback.dueAt > Date.now()) continue;
    if (
      db.callbacks.some(
        (other) =>
          other !== callback &&
          other.bankRef === callback.bankRef &&
          other.applied,
      )
    ) {
      callback.applied = true;
      continue;
    }
    callback.applied = true;
    const commerce = getCommerceDB();
    const intent = commerce.intents.find(
      (candidate) =>
        candidate.reference === callback.reference &&
        candidate.method === "VIETQR" &&
        ["CREATED", "PROCESSING"].includes(candidate.status),
    );
    if (intent) {
      if (
        new Big(callback.amount).eq(intent.amount) &&
        Date.parse(intent.expiresAt) > Date.now()
      ) {
        post(
          db,
          `COMMERCE-VIETQR:${intent.id}`,
          [
            { account: "1010", debit: callback.amount, credit: "0" },
            { account: "2030", debit: "0", credit: callback.amount },
          ],
          callback.bankRef,
        );
        intent.status = "SUCCEEDED";
        for (const order of commerce.orders.filter(
          (candidate) => candidate.payment.intentId === intent.id,
        )) {
          order.payment.status = "SUCCEEDED";
          order.payment.paidAt = now();
          order.status = "PAID";
          order.actions = [];
          order.timeline.push({ status: "PAID", at: now() });
        }
        saveCommerceDB();
      } else {
        db.suspense.push({
          bankRef: callback.bankRef,
          reference: callback.reference,
          amount: callback.amount,
          createdAt: now(),
        });
        post(
          db,
          callback.reference || callback.bankRef,
          [
            { account: "1010", debit: callback.amount, credit: "0" },
            { account: "2090", debit: "0", credit: callback.amount },
          ],
          callback.bankRef,
        );
      }
      const paymentTransfer = db.bankTransfers.find(
        (item) => item.id === callback.bankRef,
      );
      if (paymentTransfer) paymentTransfer.status = "COMPLETED";
      continue;
    }
    const top = db.topups.find(
      (t) =>
        t.reference === callback.reference &&
        (t.status === "PENDING" || t.status === "EXPIRED"),
    );
    const owner = top && db.users.find((u) => u.id === top.owner);
    if (
      !top ||
      !owner ||
      owner.status !== "ACTIVE" ||
      balance(db, owner.id)
        .plus(callback.amount)
        .gt(limits(db, owner).maxBalance)
    ) {
      db.suspense.push({
        bankRef: callback.bankRef,
        reference: callback.reference,
        amount: callback.amount,
        createdAt: now(),
      });
      const bankTransfer = db.bankTransfers.find(
        (item) => item.id === callback.bankRef,
      );
      if (bankTransfer) bankTransfer.status = "COMPLETED";
      post(
        db,
        callback.reference || callback.bankRef,
        [
          { account: "1010", debit: callback.amount, credit: "0" },
          { account: "2090", debit: "0", credit: callback.amount },
        ],
        callback.bankRef,
      );
      continue;
    }
    const journal = post(
      db,
      top.reference,
      [
        { account: "1010", debit: callback.amount, credit: "0" },
        { account: `2010:${owner.id}`, debit: "0", credit: callback.amount },
      ],
      callback.bankRef,
    );
    transaction(
      db,
      owner.id,
      "TOP_UP",
      "IN",
      callback.amount,
      top.reference,
      "",
      journal.id,
    );
    top.status = "COMPLETED";
    const bankTransfer = db.bankTransfers.find(
      (item) => item.id === callback.bankRef,
    );
    if (bankTransfer) bankTransfer.status = "COMPLETED";
  }
  save();
}
export function setBankingTierForTest(userId: string, tier: number) {
  const user = get().users.find((u) => u.id === userId);
  if (!user) throw new Error("Unknown user");
  user.kycTier = tier;
  save();
}
export function bankingTrialBalance() {
  const db = get();
  return db.journals
    .reduce(
      (total, j) =>
        total.plus(
          j.lines.reduce((v, l) => v.plus(l.debit).minus(l.credit), new Big(0)),
        ),
      new Big(0),
    )
    .toFixed();
}
const chart = [
  { code: "1010", name: "Platform bank", type: "ASSET" },
  { code: "2010", name: "Shopper wallets", type: "LIABILITY" },
  { code: "2030", name: "Escrow — orders", type: "LIABILITY" },
  { code: "2090", name: "Unmatched bank transfers", type: "LIABILITY" },
];
function accountBalances(db: BankDB) {
  const accounts = [
    ...chart.map((account) => ({
      ...account,
      code: account.code,
      ownerId: undefined as string | undefined,
    })),
    ...db.users
      .filter((owner) => owner.roles.includes("SHOPPER") && owner.kycTier >= 1)
      .map((owner) => ({
        code: `2010:${owner.id}`,
        name: `Wallet · ${mask(owner).maskedName}`,
        type: "LIABILITY",
        ownerId: owner.id,
      })),
  ];
  return accounts.map((account) => {
    const lines = db.journals
      .flatMap((journal) => journal.lines)
      .filter(
        (line) =>
          line.account === account.code ||
          (account.code === "2010" && line.account.startsWith("2010:")),
      );
    const debit = lines.reduce((sum, line) => sum.plus(line.debit), new Big(0));
    const credit = lines.reduce(
      (sum, line) => sum.plus(line.credit),
      new Big(0),
    );
    const isAsset = account.type === "ASSET";
    return {
      ...account,
      debit: debit.toFixed(),
      credit: credit.toFixed(),
      balance: (isAsset ? debit.minus(credit) : credit.minus(debit)).toFixed(),
    };
  });
}
function matchingJournals(db: BankDB, params: URLSearchParams) {
  return db.journals.filter(
    (journal) =>
      (!params.get("reference") ||
        journal.reference
          .toLowerCase()
          .includes(params.get("reference")!.toLowerCase())) &&
      (!params.get("accountCode") ||
        journal.lines.some((line) =>
          line.account.includes(params.get("accountCode")!),
        )) &&
      (!params.get("from") ||
        journal.createdAt.slice(0, 10) >= params.get("from")!) &&
      (!params.get("to") ||
        journal.createdAt.slice(0, 10) <= params.get("to")!),
  );
}
function adminTransactions(db: BankDB, ownerId: string) {
  return (db.transactions[ownerId] ?? []).map((tx) => {
    const otherId = Object.entries(db.transactions).find(
      ([candidateId, rows]) =>
        candidateId !== ownerId &&
        rows.some(
          (row) =>
            row.reference === tx.reference && row.direction !== tx.direction,
        ),
    )?.[0];
    const other = db.users.find((candidate) => candidate.id === otherId);
    return tx.counterparty && other
      ? {
          ...tx,
          counterparty: { ...tx.counterparty, fullName: other.fullName },
        }
      : tx;
  });
}
function adminOperationRows(db: BankDB) {
  return [
    ...db.topups.map(({ owner, ...topup }) => ({
      ...topup,
      type: "TOP_UP",
      ownerId: owner,
    })),
    ...Object.values(db.transactions)
      .flat()
      .filter((tx) => tx.type.startsWith("TRANSFER"))
      .map((tx) => ({ ...tx, type: "TRANSFER" })),
    ...db.suspense.map((item) => ({
      ...item,
      id: item.bankRef,
      type: "SUSPENSE",
      status: "SUSPENSE",
    })),
  ];
}
export const bankingHandlers = [
  http.get(`${API}/admin/wallets`, ({ request }) => {
    if (!staff(request)) return problem(401, "Staff sign-in required.");
    const db = get();
    const params = new URL(request.url).searchParams;
    const items = db.users
      .filter((owner) => owner.roles.includes("SHOPPER") && owner.kycTier >= 1)
      .map((owner) => ({
        id: owner.id,
        ownerName: owner.fullName,
        phone: mask(owner).maskedPhone,
        ownerType: "SHOPPER",
        kycTier: owner.kycTier,
        status: db.frozenWallets[owner.id] ? "FROZEN" : "ACTIVE",
        ledgerBalance: balance(db, owner.id).toFixed(),
        heldAmount: "0",
        availableBalance: balance(db, owner.id).toFixed(),
        limits: limits(db, owner),
      }))
      .filter(
        (wallet) =>
          !params.get("ownerType") ||
          wallet.ownerType === params.get("ownerType"),
      )
      .filter(
        (wallet) =>
          !params.get("status") || wallet.status === params.get("status"),
      )
      .filter(
        (wallet) =>
          !params.get("q") ||
          `${wallet.ownerName} ${wallet.phone}`
            .toLowerCase()
            .includes(params.get("q")!.toLowerCase()),
      );
    return HttpResponse.json(items);
  }),
  http.get(`${API}/admin/wallets/:id`, ({ request, params }) => {
    if (!staff(request)) return problem(401, "Staff sign-in required.");
    const db = get();
    const owner = db.users.find(
      (candidate) =>
        candidate.id === params.id &&
        candidate.roles.includes("SHOPPER") &&
        candidate.kycTier >= 1,
    );
    if (!owner) return problem(404, "Wallet not found.");
    return HttpResponse.json({
      id: owner.id,
      ownerName: owner.fullName,
      phone: mask(owner).maskedPhone,
      status: db.frozenWallets[owner.id] ? "FROZEN" : "ACTIVE",
      kycTier: owner.kycTier,
      ledgerBalance: balance(db, owner.id).toFixed(),
      heldAmount: "0",
      availableBalance: balance(db, owner.id).toFixed(),
      limits: limits(db, owner),
      transactions: adminTransactions(db, owner.id),
    });
  }),
  ...(["freeze", "unfreeze"] as const).map((action) =>
    http.post(
      `${API}/admin/wallets/:id/${action}`,
      async ({ request, params }) => {
        const actor = finance(request);
        if (!actor) return problem(403, "Admin or finance access is required.");
        const db = get();
        const owner = db.users.find(
          (candidate) =>
            candidate.id === params.id &&
            candidate.roles.includes("SHOPPER") &&
            candidate.kycTier >= 1,
        );
        if (!owner) return problem(404, "Wallet not found.");
        const body = await parse(request);
        if (!body.reason?.trim() || body.reason.trim().length < 3)
          return problem(422, "Add a reason of at least 3 characters.");
        const before = db.frozenWallets[owner.id]
          ? { status: "FROZEN", reason: db.frozenWallets[owner.id] }
          : { status: "ACTIVE" };
        if (action === "freeze")
          db.frozenWallets[owner.id] = body.reason.trim();
        else delete db.frozenWallets[owner.id];
        const after = db.frozenWallets[owner.id]
          ? { status: "FROZEN", reason: db.frozenWallets[owner.id] }
          : { status: "ACTIVE" };
        audit(
          db,
          actor,
          action === "freeze" ? "WALLET_FROZEN" : "WALLET_UNFROZEN",
          owner.id,
          before,
          after,
        );
        save();
        return HttpResponse.json({ id: owner.id, ...after });
      },
    ),
  ),
  http.get(`${API}/admin/wallet-operations`, ({ request }) => {
    if (!staff(request)) return problem(401, "Staff sign-in required.");
    const db = get();
    applyBankEvents(db);
    const params = new URL(request.url).searchParams;
    const rows = adminOperationRows(db).filter(
      (row) =>
        (!params.get("type") || row.type === params.get("type")) &&
        (!params.get("status") || row.status === params.get("status")) &&
        (!params.get("q") ||
          `${row.id} ${row.reference ?? ""} ${"bankRef" in row ? row.bankRef : ""}`
            .toLowerCase()
            .includes(params.get("q")!.toLowerCase())),
    );
    return HttpResponse.json(rows);
  }),
  http.get(`${API}/admin/ledger/accounts`, ({ request }) => {
    if (!staff(request)) return problem(401, "Staff sign-in required.");
    return HttpResponse.json(accountBalances(get()));
  }),
  http.get(`${API}/admin/ledger/journals`, ({ request }) => {
    if (!staff(request)) return problem(401, "Staff sign-in required.");
    const journals = matchingJournals(get(), new URL(request.url).searchParams);
    return HttpResponse.json(journals);
  }),
  http.get(`${API}/admin/ledger/journals/:id`, ({ request, params }) => {
    if (!staff(request)) return problem(401, "Staff sign-in required.");
    const journal = get().journals.find((entry) => entry.id === params.id);
    return journal
      ? HttpResponse.json(journal)
      : problem(404, "Journal not found.");
  }),
  http.get(`${API}/admin/ledger/trial-balance`, ({ request }) => {
    if (!staff(request)) return problem(401, "Staff sign-in required.");
    const lines = get().journals.flatMap((journal) => journal.lines);
    const debits = lines.reduce(
      (sum, line) => sum.plus(line.debit),
      new Big(0),
    );
    const credits = lines.reduce(
      (sum, line) => sum.plus(line.credit),
      new Big(0),
    );
    return HttpResponse.json({
      debits: debits.toFixed(),
      credits: credits.toFixed(),
      difference: debits.minus(credits).toFixed(),
    });
  }),
  http.get(`${API}/admin/audit-logs`, ({ request }) => {
    if (!staff(request)) return problem(401, "Staff sign-in required.");
    const params = new URL(request.url).searchParams;
    return HttpResponse.json(
      get().audit.filter(
        (entry) =>
          (!params.get("actor") ||
            entry.actor
              .toLowerCase()
              .includes(params.get("actor")!.toLowerCase())) &&
          (!params.get("action") ||
            entry.action
              .toLowerCase()
              .includes(params.get("action")!.toLowerCase())) &&
          (!params.get("from") ||
            entry.createdAt.slice(0, 10) >= params.get("from")!) &&
          (!params.get("to") ||
            entry.createdAt.slice(0, 10) <= params.get("to")!),
      ),
    );
  }),
  http.get(`${API}/admin/settings`, ({ request }) => {
    if (!staff(request)) return problem(401, "Staff sign-in required.");
    return HttpResponse.json(get().settings);
  }),
  http.put(`${API}/admin/settings`, async ({ request }) => {
    const actor = finance(request);
    if (!actor) return problem(403, "Admin or finance access is required.");
    const db = get();
    const body = (await request.json()) as Partial<BankingSettings>;
    const moneyKeys = [
      "tier1MaxBalance",
      "tier1PerTransaction",
      "tier1MonthlyOutflow",
      "tier2MaxBalance",
      "tier2PerTransaction",
      "tier2MonthlyOutflow",
      "otpThreshold",
    ] as const;
    if (
      moneyKeys.some(
        (key) =>
          typeof body[key] !== "string" ||
          !/^\d+$/.test(body[key]!) ||
          new Big(body[key]!).lte(0),
      ) ||
      !Number.isInteger(body.topUpTtlMinutes) ||
      body.topUpTtlMinutes! < 1 ||
      body.topUpTtlMinutes! > 120
    )
      return problem(
        422,
        "Enter positive whole-VND limits and a top-up expiry from 1 to 120 minutes.",
      );
    const before = { ...db.settings };
    db.settings = body as BankingSettings;
    audit(
      db,
      actor,
      "BANKING_SETTINGS_UPDATED",
      "wallet-limits",
      before,
      db.settings,
    );
    save();
    return HttpResponse.json(db.settings);
  }),
  http.get(`${API}/bank-sim/accounts`, () =>
    HttpResponse.json(get().bankAccounts),
  ),
  http.post(`${API}/bank-sim/accounts`, async ({ request }) => {
    const db = get();
    const b = await parse(request);
    const ownerName = b.ownerName?.trim();
    if (!ownerName || ownerName.length < 2 || ownerName.length > 80)
      return problem(422, "Enter an account holder name (2–80 characters).");
    const account = {
      id: id(),
      accountNo: `9700000000${String(db.bankAccounts.length + 1).padStart(3, "0")}`,
      ownerName,
      balance: "0",
    };
    db.bankAccounts.push(account);
    save();
    return HttpResponse.json(account, { status: 201 });
  }),
  http.post(
    `${API}/bank-sim/accounts/:id/deposit`,
    async ({ request, params }) => {
      const db = get();
      const b = await parse(request);
      const account = db.bankAccounts.find((item) => item.id === params.id);
      if (!account) return problem(404, "Bank account not found.");
      if (!amount(b.amount))
        return problem(422, "Enter a positive whole VND amount.");
      return once(db, request, b, () => {
        account.balance = new Big(account.balance).plus(b.amount).toFixed();
        return { ...account };
      });
    },
  ),
  http.get(`${API}/bank-sim/transfers`, () =>
    HttpResponse.json(get().bankTransfers),
  ),
  http.get(`${API}/bank-sim/failure-config`, () =>
    HttpResponse.json(get().failureConfig),
  ),
  http.put(`${API}/bank-sim/failure-config`, async ({ request }) => {
    const db = get(),
      b = (await request.json()) as Partial<BankDB["failureConfig"]>;
    if (
      typeof b.delayMs !== "number" ||
      b.delayMs < 0 ||
      typeof b.declineRate !== "number" ||
      b.declineRate < 0 ||
      b.declineRate > 100 ||
      typeof b.duplicateCallback !== "boolean"
    )
      return problem(422, "Invalid failure settings.");
    db.failureConfig = {
      delayMs: b.delayMs,
      declineRate: b.declineRate,
      duplicateCallback: b.duplicateCallback,
    };
    const actor = staff(request);
    if (actor)
      audit(
        db,
        actor,
        "BANK_SIM_FAILURE_SETTINGS_UPDATED",
        "bank-sim",
        null,
        db.failureConfig,
      );
    save();
    return HttpResponse.json(db.failureConfig);
  }),
  http.post(`${API}/bank-sim/transfers`, async ({ request }) => {
    const db = get(),
      body = await parse(request);
    return once(db, request, body, () => {
      const account = db.bankAccounts.find((a) => a.id === body.fromAccountId);
      if (!account) return problem(404, "Bank account not found.");
      if (!amount(body.amount))
        return problem(422, "Enter a positive whole VND amount.");
      if (new Big(account.balance).lt(body.amount))
        return problem(422, "Insufficient bank balance.");
      if (Math.random() * 100 < db.failureConfig.declineRate)
        return problem(422, "Bank transfer declined.");
      const destinationAccount = body.toAccountNo
        ? db.bankAccounts.find(
            (candidate) => candidate.accountNo === body.toAccountNo,
          )
        : undefined;
      if (body.toAccountNo && !destinationAccount)
        return problem(404, "Destination account not found.");
      if (!body.toReference && !destinationAccount)
        return problem(
          422,
          "Enter a top-up reference or a destination account number.",
        );
      if (destinationAccount?.id === account.id)
        return problem(422, "Choose a different destination account.");
      account.balance = new Big(account.balance).minus(body.amount).toFixed();
      const bankRef = id();
      const destination = destinationAccount?.accountNo ?? body.toReference;
      if (destinationAccount) {
        destinationAccount.balance = new Big(destinationAccount.balance)
          .plus(body.amount)
          .toFixed();
      } else {
        db.callbacks.push({
          bankRef,
          reference: body.toReference ?? "",
          amount: body.amount,
          dueAt: Date.now() + db.failureConfig.delayMs,
          applied: false,
        });
        if (db.failureConfig.duplicateCallback)
          db.callbacks.push({
            bankRef,
            reference: body.toReference ?? "",
            amount: body.amount,
            dueAt: Date.now() + db.failureConfig.delayMs,
            applied: false,
          });
      }
      const result = {
        id: bankRef,
        status: db.failureConfig.delayMs ? "PROCESSING" : "COMPLETED",
        reference: body.toReference ?? "",
      };
      db.bankTransfers.unshift({
        ...result,
        fromAccountNo: account.accountNo,
        to: destination,
        amount: body.amount,
        createdAt: now(),
      });
      if (!db.failureConfig.delayMs) applyBankEvents(db);
      save();
      return result;
    });
  }),

  http.post(`${API}/auth/register`, async ({ request }) => {
    const db = get(),
      b = await parse(request);
    if (!/^0\d{9}$/.test(b.phone ?? "") || !b.password || b.password.length < 8)
      return problem(400, "Enter a valid phone and password.");
    if (db.users.some((u) => u.phone === b.phone))
      return problem(409, "Phone already registered.");
    const u = makeUser(b.phone, "", 0, ["SHOPPER"]);
    u.password = b.password;
    u.status = "UNVERIFIED";
    db.users.push(u);
    db.bankAccounts.push({
      id: u.id,
      accountNo: `9700000000${String(db.bankAccounts.length + 1).padStart(3, "0")}`,
      ownerName: u.phone,
      balance: "10000000",
    });
    return otpResponse(db, otp(db, u, "register"));
  }),
  http.post(`${API}/auth/otp/resend`, async ({ request }) => {
    const db = get(),
      b = await parse(request),
      current = db.otp[b.otpId];
    if (!current) return problem(422, "Verification request expired.");
    if (current.expiresAt <= Date.now()) {
      delete db.otp[b.otpId];
      save();
      return problem(422, "Code expired. Start again to request a new code.");
    }
    if (current.resendAvailableAt > Date.now())
      return problem(429, "Please wait before requesting another code.");
    const owner = db.users.find((candidate) => candidate.id === current.userId);
    if (!owner) return problem(404, "Account not found.");
    delete db.otp[b.otpId];
    return otpResponse(db, otp(db, owner, current.purpose));
  }),
  http.post(`${API}/auth/otp/verify`, async ({ request }) => {
    const db = get(),
      b = await parse(request),
      error = verify(db, b.otpId, b.code);
    if (error) return problem(422, error);
    const o = db.otp[b.otpId],
      u = db.users.find((x) => x.id === o.userId)!;
    if (o.purpose !== "register" && o.purpose !== "login")
      return problem(422, "Invalid verification request");
    u.status = "ACTIVE";
    const device = request.headers.get("X-Mock-Device");
    if (device)
      db.devices[u.id] = [...new Set([...(db.devices[u.id] ?? []), device])];
    delete db.otp[b.otpId];
    if (u.roles.some((role) => ["ADMIN", "FINANCE", "SUPPORT"].includes(role)))
      audit(db, u, "STAFF_LOGIN", u.id, null, { status: "SUCCESS" });
    save();
    return HttpResponse.json(tokens(db, u));
  }),
  http.post(`${API}/auth/login`, async ({ request }) => {
    const db = get(),
      b = await parse(request),
      u = db.users.find((x) => x.phone === b.login || x.email === b.login);
    if (!u) return problem(401, "Invalid credentials.");
    const failure = db.loginFailures[u.id] ?? { count: 0, lockedUntil: 0 };
    if (failure.lockedUntil > Date.now())
      return problem(423, "Account locked. Try again in 15 minutes.");
    if (u.password !== b.password || u.status !== "ACTIVE") {
      failure.count++;
      if (failure.count >= 5) {
        failure.count = 0;
        failure.lockedUntil = Date.now() + 900000;
      }
      db.loginFailures[u.id] = failure;
      save();
      return problem(401, "Invalid credentials.");
    }
    delete db.loginFailures[u.id];
    const device = request.headers.get("X-Mock-Device");
    if (device && !(db.devices[u.id] ?? []).includes(device)) {
      const otpId = otp(db, u, "login");
      return HttpResponse.json(
        {
          otpRequired: true,
          otpId,
          resendAvailableAt: new Date(
            db.otp[otpId].resendAvailableAt,
          ).toISOString(),
          expiresAt: new Date(db.otp[otpId].expiresAt).toISOString(),
        },
        { headers: { "X-Mock-OTP": "123456" } },
      );
    }
    return HttpResponse.json(tokens(db, u));
  }),
  http.post(`${API}/auth/refresh`, async ({ request }) => {
    const db = get(),
      b = await parse(request),
      u = db.users.find((x) => x.id === db.refresh[b.refreshToken]);
    if (!u) return problem(401, "Session expired.");
    delete db.refresh[b.refreshToken];
    return HttpResponse.json(tokens(db, u));
  }),
  http.post(`${API}/auth/logout`, async ({ request }) => {
    const db = get(),
      b = await parse(request),
      token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
    if (token) delete db.sessions[token];
    if (b.refreshToken) delete db.refresh[b.refreshToken];
    save();
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(`${API}/auth/password/forgot`, async ({ request }) => {
    const db = get(),
      b = await parse(request),
      u = db.users.find((x) => x.phone === b.phone);
    return u
      ? otpResponse(db, otp(db, u, "reset"))
      : problem(404, "Phone not found.");
  }),
  http.post(`${API}/auth/password/reset`, async ({ request }) => {
    const db = get(),
      b = await parse(request),
      error = verify(db, b.otpId, b.code, "reset");
    if (error) return problem(422, error);
    if (!b.newPassword || b.newPassword.length < 8)
      return problem(422, "Password must contain at least 8 characters.");
    db.users.find((u) => u.id === db.otp[b.otpId].userId)!.password =
      b.newPassword;
    delete db.otp[b.otpId];
    save();
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(`${API}/me`, ({ request }) => {
    const u = user(request);
    return u
      ? HttpResponse.json(publicUser(u))
      : problem(401, "Sign in required.");
  }),
  http.put(`${API}/me/profile`, async ({ request }) => {
    const u = shopper(request);
    if (!u) return problem(401, "Sign in required.");
    const b = await parse(request);
    u.fullName = b.fullName?.trim() ?? u.fullName;
    u.email = b.email?.trim() ?? u.email;
    save();
    return HttpResponse.json(publicUser(u));
  }),
  http.put(`${API}/me/password`, async ({ request }) => {
    const u = shopper(request);
    if (!u) return problem(401, "Sign in required.");
    const b = await parse(request);
    if (b.currentPassword !== u.password)
      return problem(422, "Current password is incorrect.");
    if (typeof b.newPassword !== "string" || b.newPassword.length < 8)
      return problem(422, "New password must contain at least 8 characters.");
    if (b.newPassword === u.password)
      return problem(422, "Choose a password different from your current one.");
    u.password = b.newPassword;
    save();
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(`${API}/me/kyc/tier1`, async ({ request }) => {
    const u = shopper(request);
    if (!u) return problem(401, "Sign in required.");
    const b = await parse(request);
    if (!b.fullName?.trim() || !b.dateOfBirth || !b.idNumber?.trim())
      return problem(422, "Complete all identity fields.");
    u.fullName = b.fullName.trim();
    const bankAccount = get().bankAccounts.find(
      (account) => account.id === u.id,
    );
    if (bankAccount) bankAccount.ownerName = u.fullName;
    u.kycTier = 1;
    save();
    return HttpResponse.json(publicUser(u));
  }),
  http.get(`${API}/me/addresses`, ({ request }) => {
    const u = shopper(request);
    return u
      ? HttpResponse.json(get().addresses[u.id] ?? [])
      : problem(401, "Sign in required.");
  }),
  http.post(`${API}/me/addresses`, async ({ request }) => {
    const u = shopper(request);
    if (!u) return problem(401, "Sign in required.");
    const b = await parse(request);
    if (!b.address || !b.recipient || !b.phone)
      return problem(422, "Complete all address fields.");
    const savedAddresses = (get().addresses[u.id] ??= []);
    const isDefault =
      (b as Record<string, unknown>).isDefault === true ||
      savedAddresses.length === 0;
    if (isDefault) for (const item of savedAddresses) item.isDefault = false;
    const address: Address = {
      id: id(),
      recipient: b.recipient,
      phone: b.phone,
      address: b.address,
      isDefault,
    };
    savedAddresses.push(address);
    save();
    return HttpResponse.json(address, { status: 201 });
  }),
  http.put(`${API}/me/addresses/:id`, async ({ request, params }) => {
    const u = shopper(request),
      db = get();
    if (!u) return problem(401, "Sign in required.");
    const a = (db.addresses[u.id] ?? []).find((x) => x.id === params.id);
    if (!a) return problem(404, "Address not found.");
    const b = (await request.json()) as Partial<Address>;
    if (b.isDefault)
      for (const item of db.addresses[u.id]) item.isDefault = false;
    Object.assign(a, {
      recipient: b.recipient ?? a.recipient,
      phone: b.phone ?? a.phone,
      address: b.address ?? a.address,
      isDefault: b.isDefault ?? a.isDefault,
    });
    save();
    return HttpResponse.json(a);
  }),
  http.delete(`${API}/me/addresses/:id`, ({ request, params }) => {
    const u = shopper(request),
      db = get();
    if (!u) return problem(401, "Sign in required.");
    const wasDefault = db.addresses[u.id]?.some(
      (a) => a.id === params.id && a.isDefault,
    );
    db.addresses[u.id] = (db.addresses[u.id] ?? []).filter(
      (a) => a.id !== params.id,
    );
    if (wasDefault && db.addresses[u.id][0])
      db.addresses[u.id][0].isDefault = true;
    save();
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(`${API}/wallets/me`, ({ request }) => {
    const u = shopper(request),
      db = get();
    if (!u) return problem(401, "Sign in required.");
    if (u.kycTier < 1)
      return problem(404, "Verify your identity to open a wallet.");
    applyBankEvents(db);
    const b = balance(db, u.id).toFixed();
    return HttpResponse.json({
      id: u.id,
      status: db.frozenWallets[u.id] ? "FROZEN" : u.status,
      currency: "VND",
      ledgerBalance: b,
      heldAmount: "0",
      availableBalance: b,
      kycTier: u.kycTier,
      limits: limits(db, u),
    });
  }),
  http.get(`${API}/wallets/me/transactions`, ({ request }) => {
    const u = shopper(request),
      db = get();
    if (!u) return problem(401, "Sign in required.");
    applyBankEvents(db);
    const q = new URL(request.url).searchParams;
    const pendingTopUps = db.topups
      .filter((topup) => topup.owner === u.id && topup.status === "PENDING")
      .map((topup) => ({
        id: topup.id,
        type: "TOP_UP" as const,
        direction: "IN" as const,
        status: "PENDING" as const,
        amount: topup.amount,
        balanceAfter: topup.balanceAfter ?? balance(db, u.id).toFixed(),
        reference: topup.reference,
        note: "Awaiting bank confirmation",
        createdAt: topup.createdAt ?? topup.expiresAt,
        journalId: "",
        timeline: [
          { status: "PENDING", createdAt: topup.createdAt ?? topup.expiresAt },
        ],
      }));
    const allItems = [...(db.transactions[u.id] ?? []), ...pendingTopUps].sort(
      (left, right) => right.createdAt.localeCompare(left.createdAt),
    );
    const items = allItems.filter(
      (t) =>
        (!q.get("type") || t.type === q.get("type")) &&
        (!q.get("direction") || t.direction === q.get("direction")) &&
        (!q.get("from") || t.createdAt.slice(0, 10) >= q.get("from")!) &&
        (!q.get("to") || t.createdAt.slice(0, 10) <= q.get("to")!),
    );
    const page = Math.max(0, parseInt(q.get("page") ?? "0") || 0),
      size = Math.min(100, Math.max(1, parseInt(q.get("size") ?? "20") || 20));
    const completedItems = items.filter((item) => item.status === "COMPLETED");
    const totalIn = completedItems
        .filter((t) => t.direction === "IN")
        .reduce((sum, t) => sum.plus(t.amount), new Big(0)),
      totalOut = completedItems
        .filter((t) => t.direction === "OUT")
        .reduce((sum, t) => sum.plus(t.amount), new Big(0));
    return HttpResponse.json({
      content: items.slice(page * size, (page + 1) * size),
      page,
      size,
      totalElements: items.length,
      totalPages: Math.ceil(items.length / size),
      summary: { totalIn: totalIn.toFixed(), totalOut: totalOut.toFixed() },
    });
  }),
  http.get(`${API}/wallets/me/transactions/:id`, ({ request, params }) => {
    const u = shopper(request);
    if (!u) return problem(401, "Sign in required.");
    const t = (get().transactions[u.id] ?? []).find((x) => x.id === params.id);
    return t ? HttpResponse.json(t) : problem(404, "Transaction not found.");
  }),
  http.post(`${API}/wallets/me/top-ups`, async ({ request }) => {
    const db = get(),
      u = shopper(request);
    if (!u) return problem(401, "Sign in required.");
    const b = await parse(request);
    if (u.kycTier < 1) return problem(422, "Verify your identity first.");
    if (u.status !== "ACTIVE" || db.frozenWallets[u.id])
      return problem(422, "Wallet is frozen.");
    if (!amount(b.amount) || b.method !== "VIETQR")
      return problem(422, "Enter a positive whole VND amount.");
    return once(db, request, b, () => {
      const ref = `TOP-${id().slice(0, 8).toUpperCase()}`,
        top: TopUp & { owner: string } = {
          id: id(),
          owner: u.id,
          reference: ref,
          amount: b.amount,
          status: "PENDING",
          qrPayload: `BANKSIM:${ref}:${b.amount}`,
          expiresAt: new Date(
            Date.now() + db.settings.topUpTtlMinutes * 60000,
          ).toISOString(),
          createdAt: now(),
          balanceAfter: balance(db, u.id).toFixed(),
        };
      db.topups.push(top);
      const { owner: _, ...response } = top;
      void _;
      return response;
    });
  }),
  http.get(`${API}/top-ups/:id`, ({ request, params }) => {
    const u = shopper(request);
    if (!u) return problem(401, "Sign in required.");
    applyBankEvents(get());
    const top = get().topups.find(
      (t) => t.id === params.id && t.owner === u.id,
    );
    if (!top) return problem(404, "Top-up not found.");
    if (top.status === "PENDING" && Date.now() >= Date.parse(top.expiresAt)) {
      top.status = "EXPIRED";
      save();
    }
    const { owner: _, ...result } = top;
    void _;
    return HttpResponse.json(result);
  }),
  http.get(`${API}/wallets/recipients/lookup`, ({ request }) => {
    const u = shopper(request);
    if (!u) return problem(401, "Sign in required.");
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "",
      other = get().users.find(
        (x) => x.phone === q && x.roles.includes("SHOPPER") && x.kycTier >= 1,
      );
    return other
      ? HttpResponse.json(mask(other))
      : problem(404, "Recipient not found.");
  }),
  http.get(`${API}/wallets/me/contacts`, ({ request }) => {
    const u = shopper(request);
    if (!u) return problem(401, "Sign in required.");
    const items = (get().transactions[u.id] ?? []).flatMap((t) =>
      t.counterparty ? [t.counterparty] : [],
    );
    return HttpResponse.json([
      ...new Map(items.map((x) => [x.userId, x])).values(),
    ]);
  }),
  http.post(`${API}/wallets/me/transfers`, async ({ request }) => {
    const db = get(),
      u = shopper(request);
    if (!u) return problem(401, "Sign in required.");
    const b = await parse(request),
      to = db.users.find((x) => x.id === b.recipientUserId);
    return once(db, request, b, () => {
      const error = transferError(db, u, to, b.amount);
      if (error) return problem(422, error);
      const ref = `TR-${id().slice(0, 8).toUpperCase()}`;
      if (new Big(b.amount).gt(db.settings.otpThreshold)) {
        const otpId = otp(db, u, "transfer"),
          pending = {
            id: id(),
            from: u.id,
            to: to!.id,
            amount: b.amount,
            note: b.note ?? "",
            otpId,
          };
        db.pending.push(pending);
        return {
          id: pending.id,
          status: "OTP_REQUIRED",
          otpId,
          resendAvailableAt: new Date(
            db.otp[otpId].resendAvailableAt,
          ).toISOString(),
          expiresAt: new Date(db.otp[otpId].expiresAt).toISOString(),
        };
      }
      const tx = execute(db, u, to!, b.amount, b.note ?? "", ref);
      return { id: tx.id, status: "COMPLETED" };
    });
  }),
  http.post(`${API}/transfers/:id/confirm`, async ({ request, params }) => {
    const db = get(),
      u = shopper(request);
    if (!u) return problem(401, "Sign in required.");
    const b = await parse(request);
    return once(db, request, b, () => {
      const pending = db.pending.find(
        (p) => p.id === params.id && p.from === u.id && p.otpId === b.otpId,
      );
      if (!pending) return problem(404, "Transfer not found.");
      const error = verify(db, b.otpId, b.code, "transfer");
      if (error) return problem(422, error);
      const to = db.users.find((x) => x.id === pending.to),
        failure = transferError(db, u, to, pending.amount);
      if (failure) return problem(422, failure);
      const tx = execute(
        db,
        u,
        to!,
        pending.amount,
        pending.note,
        `TR-${pending.id.slice(0, 8).toUpperCase()}`,
      );
      db.pending = db.pending.filter((x) => x.id !== pending.id);
      delete db.otp[b.otpId];
      return { id: tx.id, status: "COMPLETED" };
    });
  }),
  http.get(`${API}/wallets/me/qr`, ({ request }) => {
    const u = shopper(request);
    if (!u) return problem(401, "Sign in required.");
    if (u.kycTier < 1)
      return problem(404, "Verify your identity to open a wallet.");
    return HttpResponse.json({
      payload: `PAYMENT:${u.id}`,
      userId: u.id,
      maskedName: mask(u).maskedName,
    });
  }),
];
