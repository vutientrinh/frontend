import Big from "big.js";
import { http, HttpResponse } from "msw";
import type {
  AdminCategory,
  AdminCustomerDetail,
  AdminCustomerRow,
  AdminOrderDetail,
  AdminSellerDetail,
  AdminSellerOrderRow,
  AdminSellerRow,
  AdminSellerStatus,
  ModerationProduct,
  SagaEvent,
} from "../../features/admin-marketplace/types";
import type {
  SellerOrderDetail,
  SellerOrderStatus,
} from "../../features/commerce/types";
import { getDB, saveDB } from "../commerce/db";
import { paymentPort } from "../commerce/paymentPort";
import { adminState, banking, saveAdminState, type BankingView } from "./state";

export { resetAdminMarketplace } from "./state";

const API = new URL("/api", location.origin).href;
const path = (value: string) => `${API}${value}`;
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const DEFAULT_COMMISSION = "5.0";
const SLA_MS = 24 * 3600 * 1000;
const PAID_STATUSES: SellerOrderStatus[] = [
  "PAID",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
];
const CANCELLABLE: SellerOrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "CONFIRMED",
  "PACKED",
];

type StoredOrder = SellerOrderDetail & {
  ownerId: string;
  paymentIntentId?: string;
};
type StaffUser = BankingView["users"][number];

const problem = (
  status: number,
  detail: string,
  fieldErrors: { field: string; message: string }[] = [],
) =>
  HttpResponse.json(
    {
      type: "about:blank",
      title:
        status === 404
          ? "Not Found"
          : status === 409
            ? "Conflict"
            : status === 403
              ? "Forbidden"
              : status === 401
                ? "Unauthorized"
                : "Invalid request",
      status,
      detail,
      fieldErrors,
    },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );

function staff(request: Request): StaffUser | undefined {
  const token = /^Bearer (.+)$/.exec(
    request.headers.get("Authorization") ?? "",
  )?.[1];
  const db = banking();
  const user = db.users.find((u) => u.id === db.sessions[token ?? ""]);
  return user?.status === "ACTIVE" &&
    user.roles.some((r) => ["ADMIN", "SUPPORT", "FINANCE"].includes(r))
    ? user
    : undefined;
}

/** Reads: any staff role. Writes: ADMIN/SUPPORT; commission: ADMIN/FINANCE. */
function guard(request: Request, write?: "ops" | "commission") {
  const user = staff(request);
  if (!user) return { error: problem(401, "Staff sign-in required") };
  const allowed =
    write === "ops"
      ? ["ADMIN", "SUPPORT"]
      : write === "commission"
        ? ["ADMIN", "FINANCE"]
        : ["ADMIN", "SUPPORT", "FINANCE"];
  if (!user.roles.some((r) => allowed.includes(r)))
    return { error: problem(403, "Your role cannot do this") };
  return { user };
}

function audit(
  actor: StaffUser,
  action: string,
  subject: string,
  before: unknown,
  after: unknown,
  reason?: string,
) {
  adminState().adminAudit.unshift({
    id: id(),
    actor: actor.fullName,
    action,
    subject,
    ...(reason ? { reason } : {}),
    before,
    after,
    createdAt: now(),
  });
  saveAdminState();
}

const body = async <T>(request: Request): Promise<Partial<T>> => {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {};
  }
};

function page<T>(items: T[], url: URL) {
  const p = Math.max(0, Number(url.searchParams.get("page")) || 0);
  const size = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("size")) || 20),
  );
  return {
    content: items.slice(p * size, (p + 1) * size),
    page: p,
    size,
    totalElements: items.length,
    totalPages: Math.ceil(items.length / size),
  };
}

/** Sort by `sort=field,dir` on plain object fields (money compared as decimals). */
function sortRows<T extends object>(
  rows: T[],
  url: URL,
  moneyFields: string[],
) {
  const [field, dir] = (url.searchParams.get("sort") ?? "").split(",");
  if (!field) return rows;
  const sign = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = (a as Record<string, unknown>)[field];
    const y = (b as Record<string, unknown>)[field];
    if (moneyFields.includes(field))
      return new Big(String(x ?? 0)).cmp(String(y ?? 0)) * sign;
    if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
    return String(x ?? "").localeCompare(String(y ?? "")) * sign;
  });
}

const sum = (values: string[]) =>
  values.reduce((s, v) => s.plus(v), new Big(0)).toFixed(0);

// ---------- customers ----------

const ownedBy = (order: StoredOrder, user: { id: string; phone: string }) =>
  order.ownerId === user.id || order.ownerId === `phone:${user.phone}`;

function walletBalance(db: BankingView, userId: string) {
  return db.journals
    .flatMap((j) => j.lines)
    .filter((l) => l.account === `2010:${userId}`)
    .reduce((a, l) => a.plus(l.credit).minus(l.debit), new Big(0))
    .toFixed(0);
}

function customerRow(
  db: BankingView,
  user: StaffUser,
  orders: StoredOrder[],
): AdminCustomerRow {
  const mine = orders.filter((o) => ownedBy(o, user));
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    kycTier: user.kycTier,
    status: db.frozenWallets?.[user.id] ? "FROZEN" : user.status,
    walletBalance: walletBalance(db, user.id),
    ordersCount: mine.length,
    totalSpent: sum(
      mine.filter((o) => PAID_STATUSES.includes(o.status)).map((o) => o.total),
    ),
    createdAt:
      db.transactions[user.id]?.at(-1)?.createdAt ?? "2026-01-01T00:00:00Z",
  };
}

// ---------- orders ----------

function customerOf(order: StoredOrder) {
  const user = banking().users.find(
    (u) => order.ownerId === u.id || order.ownerId === `phone:${u.phone}`,
  );
  return user
    ? { name: user.fullName, phone: user.phone }
    : {
        name: order.shippingAddress.recipient,
        phone: order.shippingAddress.phone,
      };
}

function parentNumber(order: StoredOrder) {
  return order.orderNumber.replace(/-[A-Z]$/, "");
}

function slaBreached(order: StoredOrder) {
  if (order.status !== "PAID") return false;
  const paidAt =
    order.payment.paidAt ??
    order.timeline.find((t) => t.status === "PAID")?.at ??
    order.createdAt;
  return Date.now() - Date.parse(paidAt) > SLA_MS;
}

function orderRow(order: StoredOrder): AdminSellerOrderRow {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    parentOrderNumber: parentNumber(order),
    seller: order.seller,
    customer: customerOf(order),
    status: order.status,
    total: order.total,
    paymentMethod: order.payment.method,
    createdAt: order.createdAt,
    slaBreached: slaBreached(order),
  };
}

function intentOf(order: StoredOrder) {
  return getDB().intents.find(
    (i) => i.id === (order.paymentIntentId ?? order.payment.intentId),
  );
}

/** Saga trace derived from the order timeline, payment intent and shipment (F3/F4). */
function sagaEvents(order: StoredOrder): SagaEvent[] {
  const correlationId = order.parentOrderId;
  const intent = intentOf(order);
  const events: SagaEvent[] = [
    {
      type: "CheckoutStarted",
      service: "commerce",
      at: order.createdAt,
      correlationId,
      summary: `Parent order ${parentNumber(order)} created`,
    },
    {
      type: "StockReserved",
      service: "commerce",
      at: order.createdAt,
      correlationId,
      summary: `${order.itemCount} item(s) reserved for 15 min`,
    },
  ];
  if (intent)
    events.push({
      type: "PaymentIntentCreated",
      service: "payment",
      at: order.createdAt,
      correlationId,
      summary: `${intent.method === "WALLET" ? "Wallet" : "VietQR"} intent for ${intent.amount} VND`,
    });
  const terminal = order.payment.status;
  const paidAt =
    order.payment.paidAt ?? order.timeline.find((t) => t.status === "PAID")?.at;
  if (terminal === "SUCCEEDED") {
    if (order.payment.method === "VIETQR")
      events.push({
        type: "IncomingTransferReceived",
        service: "bank-sim",
        at: paidAt ?? order.createdAt,
        correlationId,
        summary: `Transfer matched reference ${intent?.reference ?? parentNumber(order)}`,
      });
    events.push({
      type: "PaymentSucceeded",
      service: "payment",
      at: paidAt ?? order.createdAt,
      correlationId,
      summary: "Captured into escrow (Dr 2010 / Cr 2030)",
    });
  } else if (["FAILED", "EXPIRED", "CANCELLED"].includes(terminal))
    events.push({
      type: `Payment${terminal.charAt(0)}${terminal.slice(1).toLowerCase()}`,
      service: "payment",
      at:
        order.timeline.find((t) => t.status === "CANCELLED")?.at ??
        order.createdAt,
      correlationId,
      summary: intent?.failureReason ?? `Intent ${terminal.toLowerCase()}`,
    });
  for (const step of order.timeline)
    if (step.status !== "PENDING_PAYMENT")
      events.push({
        type: `Order${step.status
          .toLowerCase()
          .replace(/(^|_)(\w)/g, (_, __, c: string) => c.toUpperCase())}`,
        service: "commerce",
        at: step.at,
        correlationId,
        summary: step.note ?? `Seller order moved to ${step.status}`,
      });
  for (const event of order.shipment?.events ?? [])
    events.push({
      type: `Shipment${event.status.charAt(0)}${event.status.slice(1).toLowerCase()}`,
      service: "carrier",
      at: event.at,
      correlationId,
      summary: `${order.shipment!.carrier} ${order.shipment!.trackingNo} at ${event.location}`,
    });
  return events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

// ---------- sellers ----------

function sellerStatus(sellerId: string): AdminSellerStatus {
  if (adminState().suspended[sellerId]) return "SUSPENDED";
  const status = getDB().onboarding[sellerId]?.status ?? "APPROVED";
  return status === "DRAFT" ? "ONBOARDING" : status;
}

function sellerRow(sellerId: string): AdminSellerRow | undefined {
  const db = getDB();
  const seller = db.sellers.find((s) => s.id === sellerId);
  if (!seller) return undefined;
  const steps = db.onboarding[seller.id]?.steps ?? {};
  const since = Date.now() - 30 * 24 * 3600 * 1000;
  return {
    id: seller.id,
    slug: seller.slug,
    name: seller.name,
    status: sellerStatus(seller.id),
    ownerName: steps.owner?.fullName ?? `${seller.name} owner`,
    location: seller.location,
    rating: seller.rating,
    productCount: db.products.filter((p) => p.seller.id === seller.id).length,
    gmv30d: sum(
      (db.orders as StoredOrder[])
        .filter(
          (o) =>
            o.seller.id === seller.id &&
            PAID_STATUSES.includes(o.status) &&
            Date.parse(o.createdAt) >= since,
        )
        .map((o) => o.total),
    ),
    commissionRatePercent:
      adminState().sellerCommission[seller.id] ?? DEFAULT_COMMISSION,
    createdAt: "2026-01-01T00:00:00Z",
  };
}

function sellerDetail(sellerId: string): AdminSellerDetail | undefined {
  const row = sellerRow(sellerId);
  if (!row) return undefined;
  const db = getDB();
  const products = db.products.filter((p) => p.seller.id === sellerId);
  return {
    ...row,
    statusReason: adminState().sellerStatusReason[sellerId],
    onboarding: db.onboarding[sellerId]?.steps ?? {},
    recentOrders: (db.orders as StoredOrder[])
      .filter((o) => o.seller.id === sellerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10)
      .map(orderRow),
    products: {
      live: products.filter((p) => p.status === "LIVE").length,
      pendingReview: products.filter((p) => p.status === "PENDING_REVIEW")
        .length,
      rejected: products.filter((p) => p.status === "REJECTED").length,
      hidden: products.filter((p) => p.status === "HIDDEN").length,
      outOfStock: products.filter((p) => !p.variants.some((v) => v.stock > 0))
        .length,
    },
  };
}

const RATE = /^(?:\d{1,2})(?:\.\d)?$/;
function validRate(value: unknown) {
  if (typeof value !== "string" || !RATE.test(value)) return undefined;
  const rate = new Big(value);
  return rate.gte(0) && rate.lte(30) ? rate.toFixed(1) : undefined;
}

// ---------- categories ----------

function categoryTree(): AdminCategory[] {
  const db = getDB();
  const rates = adminState().categoryCommission;
  const counts = (slug: string) =>
    db.products.filter((p) => p.category.slug === slug).length;
  const build = (parentId: string | null): AdminCategory[] =>
    db.categories
      .filter((c) => (c.parentId ?? null) === parentId)
      .map((c) => {
        const children = build(c.id);
        return {
          ...c,
          commissionRatePercent: rates[c.id] ?? DEFAULT_COMMISSION,
          productCount:
            counts(c.slug) + children.reduce((n, ch) => n + ch.productCount, 0),
          children,
        };
      });
  return build(null);
}

const slugify = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// ---------- handlers ----------

export const adminMarketplaceHandlers = [
  http.get(path("/admin/customers"), ({ request }) => {
    const g = guard(request);
    if (g.error) return g.error;
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.toLowerCase().trim();
    const tier = url.searchParams.get("kycTier");
    const db = banking();
    const orders = getDB().orders as StoredOrder[];
    let rows = db.users
      .filter((u) => u.roles.includes("SHOPPER"))
      .map((u) => customerRow(db, u, orders));
    if (q)
      rows = rows.filter(
        (r) => r.fullName.toLowerCase().includes(q) || r.phone.includes(q),
      );
    if (tier) rows = rows.filter((r) => String(r.kycTier) === tier);
    return HttpResponse.json(
      page(sortRows(rows, url, ["walletBalance", "totalSpent"]), url),
    );
  }),
  http.get(path("/admin/customers/:id"), ({ request, params }) => {
    const g = guard(request);
    if (g.error) return g.error;
    const db = banking();
    const user = db.users.find(
      (u) => u.id === params.id && u.roles.includes("SHOPPER"),
    );
    if (!user) return problem(404, "Customer not found");
    const orders = getDB().orders as StoredOrder[];
    const detail: AdminCustomerDetail = {
      ...customerRow(db, user, orders),
      email: user.email ?? "",
      addresses: db.addresses[user.id] ?? [],
      wallet: {
        available: walletBalance(db, user.id),
        frozen: !!db.frozenWallets?.[user.id],
      },
      recentTransactions: [...(db.transactions[user.id] ?? [])]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10),
      recentOrders: orders
        .filter((o) => ownedBy(o, user))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10)
        .map(orderRow),
    };
    return HttpResponse.json(detail);
  }),

  http.get(path("/admin/sellers"), ({ request }) => {
    const g = guard(request);
    if (g.error) return g.error;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q")?.toLowerCase().trim();
    let rows = getDB()
      .sellers.map((s) => sellerRow(s.id))
      .filter((r): r is AdminSellerRow => !!r);
    if (status) rows = rows.filter((r) => r.status === status);
    if (q)
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.ownerName.toLowerCase().includes(q) ||
          r.slug.includes(q),
      );
    return HttpResponse.json(page(sortRows(rows, url, ["gmv30d"]), url));
  }),
  http.get(path("/admin/sellers/:id"), ({ request, params }) => {
    const g = guard(request);
    if (g.error) return g.error;
    const detail = sellerDetail(String(params.id));
    return detail
      ? HttpResponse.json(detail)
      : problem(404, "Seller not found");
  }),
  http.post(path("/admin/sellers/:id/:action"), async ({ request, params }) => {
    const g = guard(request, "ops");
    if (g.error) return g.error;
    const sellerId = String(params.id);
    const action = String(params.action);
    const before = sellerRow(sellerId);
    if (!before) return problem(404, "Seller not found");
    const input = await body<{ reason: string }>(request);
    const reason = input.reason?.trim();
    const db = getDB();
    const state = adminState();
    const onboarding = db.onboarding[sellerId];
    const needsReason = action === "reject" || action === "suspend";
    if (needsReason && !reason)
      return problem(400, "A reason is required", [
        { field: "reason", message: "Enter a reason" },
      ]);
    if (action === "approve" || action === "reject") {
      if (!["UNDER_REVIEW", "REJECTED", "ONBOARDING"].includes(before.status))
        return problem(409, `Seller is ${before.status.toLowerCase()}`);
      if (action === "approve" && before.status === "ONBOARDING")
        return problem(409, "The seller has not submitted onboarding yet");
      if (onboarding) {
        onboarding.status = action === "approve" ? "APPROVED" : "REJECTED";
        if (action === "reject") onboarding.rejectionReason = reason;
        else delete onboarding.rejectionReason;
      }
    } else if (action === "suspend") {
      if (before.status !== "APPROVED")
        return problem(409, "Only approved sellers can be suspended");
      const hidden = db.products.filter(
        (p) => p.seller.id === sellerId && p.status === "LIVE",
      );
      hidden.forEach((p) => (p.status = "HIDDEN"));
      state.suspended[sellerId] = {
        reason: reason!,
        hiddenProductIds: hidden.map((p) => p.id),
      };
    } else if (action === "reinstate") {
      const suspension = state.suspended[sellerId];
      if (!suspension) return problem(409, "Seller is not suspended");
      db.products
        .filter((p) => suspension.hiddenProductIds.includes(p.id))
        .forEach((p) => (p.status = "LIVE"));
      delete state.suspended[sellerId];
    } else return problem(404, "Unknown action");
    if (reason) state.sellerStatusReason[sellerId] = reason;
    else delete state.sellerStatusReason[sellerId];
    saveDB();
    saveAdminState();
    const after = sellerRow(sellerId)!;
    audit(
      g.user,
      `seller.${action}`,
      `seller:${before.slug}`,
      { status: before.status },
      { status: after.status },
      reason,
    );
    return HttpResponse.json(sellerDetail(sellerId));
  }),
  http.put(
    path("/admin/sellers/:id/commission"),
    async ({ request, params }) => {
      const g = guard(request, "commission");
      if (g.error) return g.error;
      const sellerId = String(params.id);
      const before = sellerRow(sellerId);
      if (!before) return problem(404, "Seller not found");
      const input = await body<{ ratePercent: string }>(request);
      const rate = validRate(input.ratePercent);
      if (!rate)
        return problem(400, "Commission must be 0–30 % with one decimal", [
          { field: "ratePercent", message: "Enter 0–30 with one decimal" },
        ]);
      adminState().sellerCommission[sellerId] = rate;
      saveAdminState();
      audit(
        g.user,
        "seller.commission",
        `seller:${before.slug}`,
        { ratePercent: before.commissionRatePercent },
        { ratePercent: rate },
      );
      return HttpResponse.json(sellerDetail(sellerId));
    },
  ),

  http.get(path("/admin/catalog/categories"), ({ request }) => {
    const g = guard(request);
    if (g.error) return g.error;
    return HttpResponse.json(categoryTree());
  }),
  http.post(path("/admin/catalog/categories"), async ({ request }) => {
    const g = guard(request, "ops");
    if (g.error) return g.error;
    const input = await body<{
      name: string;
      parentId: string | null;
      commissionRatePercent: string;
    }>(request);
    const db = getDB();
    const name = input.name?.trim();
    const rate = validRate(input.commissionRatePercent ?? DEFAULT_COMMISSION);
    const fieldErrors = [
      ...(!name ? [{ field: "name", message: "Enter a name" }] : []),
      ...(!rate
        ? [{ field: "commissionRatePercent", message: "Enter 0–30" }]
        : []),
    ];
    if (fieldErrors.length)
      return problem(400, "Check the highlighted fields", fieldErrors);
    const parent = input.parentId
      ? db.categories.find((c) => c.id === input.parentId)
      : undefined;
    if (input.parentId && !parent) return problem(404, "Parent not found");
    if (parent?.parentId)
      return problem(400, "Categories have two levels only", [
        { field: "parentId", message: "Choose a top-level category" },
      ]);
    const slug = slugify(parent ? `${parent.slug}-${name}` : name!);
    if (db.categories.some((c) => c.slug === slug))
      return problem(409, "A category with this name already exists");
    const category = {
      id: id(),
      slug,
      name: name!,
      parentId: parent?.id ?? null,
      iconName: "Package",
    };
    db.categories.push(category);
    adminState().categoryCommission[category.id] = rate!;
    saveDB();
    saveAdminState();
    audit(g.user, "category.create", `category:${slug}`, null, {
      name,
      commissionRatePercent: rate,
    });
    return HttpResponse.json(
      categoryTree()
        .flatMap((c) => [c, ...c.children])
        .find((c) => c.id === category.id),
      { status: 201 },
    );
  }),
  http.put(
    path("/admin/catalog/categories/:id"),
    async ({ request, params }) => {
      const g = guard(request, "ops");
      if (g.error) return g.error;
      const db = getDB();
      const category = db.categories.find((c) => c.id === params.id);
      if (!category) return problem(404, "Category not found");
      const input = await body<{ name: string; commissionRatePercent: string }>(
        request,
      );
      const name = input.name?.trim();
      const rate =
        input.commissionRatePercent === undefined
          ? undefined
          : validRate(input.commissionRatePercent);
      if (input.name !== undefined && !name)
        return problem(400, "Enter a name", [
          { field: "name", message: "Enter a name" },
        ]);
      if (input.commissionRatePercent !== undefined && !rate)
        return problem(400, "Commission must be 0–30 % with one decimal", [
          { field: "commissionRatePercent", message: "Enter 0–30" },
        ]);
      const before = {
        name: category.name,
        commissionRatePercent:
          adminState().categoryCommission[category.id] ?? DEFAULT_COMMISSION,
      };
      if (name) {
        category.name = name;
        // Keep product snapshots readable; slug stays stable for URLs.
        db.products
          .filter((p) => p.category.slug === category.slug)
          .forEach((p) => (p.category.name = name));
      }
      if (rate) adminState().categoryCommission[category.id] = rate;
      saveDB();
      saveAdminState();
      audit(g.user, "category.update", `category:${category.slug}`, before, {
        name: category.name,
        commissionRatePercent:
          adminState().categoryCommission[category.id] ?? DEFAULT_COMMISSION,
      });
      return HttpResponse.json(
        categoryTree()
          .flatMap((c) => [c, ...c.children])
          .find((c) => c.id === category.id),
      );
    },
  ),

  http.get(path("/admin/catalog/moderation"), ({ request }) => {
    const g = guard(request);
    if (g.error) return g.error;
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "PENDING_REVIEW";
    const rows: ModerationProduct[] = getDB()
      .products.filter((p) => p.status === status)
      .map((p) => ({
        ...p,
        ...(adminState().productRejections[p.id]
          ? { rejectionReason: adminState().productRejections[p.id] }
          : {}),
      }));
    return HttpResponse.json(page(rows, url));
  }),
  http.post(
    path("/admin/catalog/products/:id/:action"),
    async ({ request, params }) => {
      const g = guard(request, "ops");
      if (g.error) return g.error;
      const product = getDB().products.find((p) => p.id === params.id);
      if (!product) return problem(404, "Product not found");
      const action = String(params.action);
      if (action !== "approve" && action !== "reject")
        return problem(404, "Unknown action");
      if (product.status !== "PENDING_REVIEW")
        return problem(409, `Product is ${product.status.toLowerCase()}`);
      const reason = (await body<{ reason: string }>(request)).reason?.trim();
      if (action === "reject" && !reason)
        return problem(400, "A reason is required", [
          { field: "reason", message: "Enter a reason" },
        ]);
      const before = product.status;
      product.status = action === "approve" ? "LIVE" : "REJECTED";
      if (reason) adminState().productRejections[product.id] = reason;
      else delete adminState().productRejections[product.id];
      saveDB();
      saveAdminState();
      audit(
        g.user,
        `product.${action}`,
        `product:${product.slug}`,
        { status: before },
        { status: product.status },
        reason,
      );
      return HttpResponse.json({
        ...product,
        ...(reason ? { rejectionReason: reason } : {}),
      });
    },
  ),

  http.get(path("/admin/marketplace-orders"), ({ request }) => {
    const g = guard(request);
    if (g.error) return g.error;
    const url = new URL(request.url);
    const p = url.searchParams;
    const q = p.get("q")?.toLowerCase().trim();
    const from = p.get("from");
    const to = p.get("to");
    let rows = (getDB().orders as StoredOrder[]).map(orderRow);
    if (p.get("status"))
      rows = rows.filter((r) => r.status === p.get("status"));
    if (p.get("sellerSlug"))
      rows = rows.filter((r) => r.seller.slug === p.get("sellerSlug"));
    if (p.get("paymentMethod"))
      rows = rows.filter((r) => r.paymentMethod === p.get("paymentMethod"));
    if (from) rows = rows.filter((r) => r.createdAt.slice(0, 10) >= from);
    if (to) rows = rows.filter((r) => r.createdAt.slice(0, 10) <= to);
    if (p.get("slaBreached") === "true")
      rows = rows.filter((r) => r.slaBreached);
    if (q)
      rows = rows.filter(
        (r) =>
          r.orderNumber.toLowerCase().includes(q) ||
          r.customer.name.toLowerCase().includes(q) ||
          r.customer.phone.includes(q),
      );
    rows = p.get("sort")
      ? sortRows(rows, url, ["total"])
      : rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json(page(rows, url));
  }),
  http.get(path("/admin/marketplace-orders/:id"), ({ request, params }) => {
    const g = guard(request);
    if (g.error) return g.error;
    const order = (getDB().orders as StoredOrder[]).find(
      (o) => o.id === params.id,
    );
    if (!order) return problem(404, "Order not found");
    // Staff see full names: drop the seller-facing masked buyer block.
    const { ownerId: _owner, buyer: _buyer, ...rest } = order;
    void _owner;
    void _buyer;
    const detail: AdminOrderDetail = {
      ...rest,
      ...orderRow(order),
      items: order.items,
      sagaEvents: sagaEvents(order),
      paymentIntent: intentOf(order),
    };
    return HttpResponse.json(detail);
  }),
  http.post(
    path("/admin/marketplace-orders/:id/cancel"),
    async ({ request, params }) => {
      const g = guard(request, "ops");
      if (g.error) return g.error;
      const db = getDB();
      const order = (db.orders as StoredOrder[]).find(
        (o) => o.id === params.id,
      );
      if (!order) return problem(404, "Order not found");
      const reason = (await body<{ reason: string }>(request)).reason?.trim();
      if (!reason)
        return problem(400, "A reason is required", [
          { field: "reason", message: "Enter a reason" },
        ]);
      if (!CANCELLABLE.includes(order.status))
        return problem(
          409,
          `Order is ${order.status.toLowerCase().replaceAll("_", " ")} and can no longer be cancelled`,
        );
      const before = order.status;
      const paid = order.payment.status === "SUCCEEDED";
      // Refund through the payment port when it supports it (fe-dev-2 adds `refund`).
      const port = paymentPort as typeof paymentPort & {
        refund?: (
          userId: string,
          amount: string,
          refs: { intentId: string; sellerOrderId: string },
        ) => Promise<unknown>;
      };
      if (paid && port.refund)
        await port.refund(order.ownerId, order.total, {
          intentId: order.payment.intentId,
          sellerOrderId: order.id,
        });
      order.status = "CANCELLED";
      order.actions = [];
      order.timeline.push({
        status: "CANCELLED",
        at: now(),
        note: paid
          ? `Cancelled by staff: ${reason}. Refund ${order.total} VND to ${order.payment.method === "WALLET" ? "wallet" : "original method"}.`
          : `Cancelled by staff: ${reason}.`,
      });
      if (!paid) {
        const intent = intentOf(order);
        if (
          intent &&
          ["CREATED", "PROCESSING", "REQUIRES_ACTION"].includes(intent.status)
        )
          intent.status = "CANCELLED";
        order.payment.status = "CANCELLED";
      }
      const variants = db.products.flatMap((p) => p.variants);
      for (const item of order.items as ((typeof order.items)[number] & {
        variantId?: string;
      })[]) {
        const variant = variants.find((v) => v.id === item.variantId);
        if (variant) variant.stock += item.quantity;
      }
      saveDB();
      audit(
        g.user,
        "order.cancel",
        `order:${order.orderNumber}`,
        { status: before },
        { status: "CANCELLED", refund: paid ? order.total : "0" },
        reason,
      );
      return HttpResponse.json({ ok: true });
    },
  ),
  http.get(path("/admin/marketplace-audit"), ({ request }) => {
    const g = guard(request);
    if (g.error) return g.error;
    return HttpResponse.json(adminState().adminAudit);
  }),
];

/** Audit entries for fe-dev to merge into `/admin/audit-logs`. */
export const adminMarketplaceAudit = () => adminState().adminAudit;
