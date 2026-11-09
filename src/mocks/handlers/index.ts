import { bankingHandlers } from "../banking";
import { commerceHandlers } from "../commerce";
import { adminMarketplaceHandlers } from "../admin-marketplace";
import { delay, http, HttpResponse } from "msw";
import Big from "big.js";
import { getDB, saveDB, simulateErrors } from "../db";
import type {
  Order,
  Payment,
  PaymentHistory,
  OutboxEvent,
} from "../../api/types";

const API = new URL("/api", window.location.origin).href;
const problem = (
  status: number,
  detail: string,
  fieldErrors?: { field: string; message: string }[],
) =>
  HttpResponse.json(
    {
      type: "about:blank",
      title:
        status === 400
          ? "Validation failed"
          : status === 409
            ? "Conflict"
            : "Request failed",
      status,
      detail,
      ...(fieldErrors ? { fieldErrors } : {}),
    },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const allowed: Record<string, string[]> = {
  PENDING: ["PROCESSING", "FAILED"],
  PROCESSING: ["COMPLETED", "FAILED"],
  COMPLETED: ["REFUNDED"],
  FAILED: [],
  REFUNDED: [],
};
function updatePayment(
  p: Payment,
  status: string,
  source: "SYSTEM" | "MANUAL",
  changedAt = now(),
) {
  const db = getDB();
  p.status = status;
  p.updatedAt = changedAt;
  (db.history[p.id] ??= []).push({ status, changedAt, source });
  db.events.unshift({
    id: id(),
    eventType: "payment.status-changed.v1",
    aggregateType: "PAYMENT",
    aggregateId: p.id,
    status: "PENDING",
    attempts: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: changedAt,
    publishedAt: null,
  });
  const order = db.orders.find((o) => o.id === p.orderId);
  if (order)
    order.status =
      (
        {
          PROCESSING: "PAYMENT_PROCESSING",
          COMPLETED: "PAID",
          FAILED: "PAYMENT_FAILED",
          REFUNDED: "REFUNDED",
        } as Record<string, string>
      )[status] ?? order.status;
  saveDB();
}
export function advance() {
  for (const p of getDB().payments) {
    const elapsed = Date.now() - Date.parse(p.createdAt);
    if (p.status === "PENDING" && elapsed >= 3000)
      updatePayment(
        p,
        "PROCESSING",
        "SYSTEM",
        new Date(Date.parse(p.createdAt) + 3000).toISOString(),
      );
    if (p.status === "PROCESSING" && elapsed >= 8000)
      updatePayment(p, Math.random() < 0.85 ? "COMPLETED" : "FAILED", "SYSTEM");
  }
}
function page<T>(items: T[], url: URL) {
  const page = Math.max(
      0,
      parseInt(url.searchParams.get("page") ?? "0", 10) || 0,
    ),
    size = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("size") ?? "20", 10) || 20),
    );
  const [key, dir] = (url.searchParams.get("sort") ?? "").split(",");
  if (key)
    items = [...items].sort(
      (a, b) =>
        String((a as Record<string, unknown>)[key] ?? "").localeCompare(
          String((b as Record<string, unknown>)[key] ?? ""),
          undefined,
          { numeric: true },
        ) * (dir === "desc" ? -1 : 1),
    );
  return {
    content: items.slice(page * size, (page + 1) * size),
    page,
    size,
    totalElements: items.length,
    totalPages: Math.ceil(items.length / size),
  };
}
async function before() {
  await delay(250 + Math.floor(Math.random() * 451));
  if (import.meta.env.DEV && simulateErrors() && Math.random() < 0.1)
    return problem(500, "Simulated server error");
  advance();
}
const body = async (
  request: Request,
): Promise<Record<string, unknown> | null> => {
  try {
    const value = await request.json();
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};
const match = (v: unknown, q: string) =>
  String(v ?? "")
    .toLowerCase()
    .includes(q.toLowerCase());
const notFound = () => problem(404, "Record not found");
function validate(resource: string, data: Record<string, unknown>) {
  const required =
    resource === "customers"
      ? ["firstName", "lastName", "email", "phoneNumber"]
      : resource === "products"
        ? ["productName", "productDescription", "unitPrice"]
        : resource === "orders"
          ? ["orderCode", "customerId"]
          : ["orderId", "method"];
  const errors = required
    .filter((k) => typeof data[k] !== "string" || !(data[k] as string).trim())
    .map((field) => ({ field, message: "Required" }));
  if (
    resource === "customers" &&
    typeof data.email === "string" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
  )
    errors.push({ field: "email", message: "Enter a valid email" });
  if (
    resource === "products" &&
    (typeof data.unitPrice !== "string" ||
      !/^\d+(\.\d{1,4})?$/.test(data.unitPrice) ||
      !new Big(data.unitPrice).gt(0))
  )
    errors.push({
      field: "unitPrice",
      message: "Enter a positive decimal price",
    });
  if (
    resource === "orders" &&
    (!Array.isArray(data.items) || !data.items.length)
  )
    errors.push({ field: "items", message: "At least one item is required" });
  if (
    resource === "payments" &&
    !["CARD", "BANK_TRANSFER", "EWALLET"].includes(String(data.method))
  )
    errors.push({ field: "method", message: "Invalid payment method" });
  return errors;
}
function eventFor(p: Payment) {
  const event: OutboxEvent = {
    id: id(),
    eventType: "payment.requested.v1",
    aggregateType: "PAYMENT",
    aggregateId: p.id,
    status: "PENDING",
    attempts: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: now(),
    publishedAt: null,
  };
  getDB().events.unshift(event);
}
export const handlers = [
  ...bankingHandlers,
  ...commerceHandlers,
  ...adminMarketplaceHandlers,
  http.get(`${API}/payments/summary`, async ({ request }) => {
    const e = await before();
    if (e) return e;
    const u = new URL(request.url),
      db = getDB();
    const list = db.payments.filter(
      (p) =>
        (!u.searchParams.get("from") ||
          p.createdAt.slice(0, 10) >= u.searchParams.get("from")!) &&
        (!u.searchParams.get("to") ||
          p.createdAt.slice(0, 10) <= u.searchParams.get("to")!),
    );
    const sum = (xs: Payment[]) =>
      xs.reduce((a, p) => a.plus(p.amount), new Big(0)).toFixed();
    const statuses = [
      "PENDING",
      "PROCESSING",
      "COMPLETED",
      "FAILED",
      "REFUNDED",
    ];
    const dates = [
      ...new Set(list.map((p) => p.createdAt.slice(0, 10))),
    ].sort();
    return HttpResponse.json({
      currency: "VND",
      totalAmount: sum(list),
      totalCount: list.length,
      byStatus: statuses.map((status) => {
        const xs = list.filter((p) => p.status === status);
        return { status, count: xs.length, amount: sum(xs) };
      }),
      daily: dates.map((date) => {
        const xs = list.filter((p) => p.createdAt.startsWith(date));
        return { date, count: xs.length, amount: sum(xs) };
      }),
    });
  }),
  http.get(`${API}/payments/:id/history`, async ({ params }) => {
    const e = await before();
    if (e) return e;
    return getDB().payments.some((p) => p.id === params.id)
      ? HttpResponse.json(getDB().history[String(params.id)] ?? [])
      : notFound();
  }),
  http.patch(`${API}/payments/:id/status`, async ({ params, request }) => {
    const e = await before();
    if (e) return e;
    const p = getDB().payments.find((x) => x.id === params.id);
    if (!p) return notFound();
    const data = await body(request);
    const status = String(data?.status ?? "");
    if (!status)
      return problem(400, "Status required", [
        { field: "status", message: "Required" },
      ]);
    if (!allowed[p.status]?.includes(status))
      return problem(409, "Invalid status transition");
    updatePayment(p, status, "MANUAL");
    return HttpResponse.json(p);
  }),
  http.get(`${API}/:resource/:id`, async ({ params }) => {
    const e = await before();
    if (e) return e;
    const db = getDB();
    const resource = String(params.resource);
    const lists: Record<string, unknown[]> = {
      customers: db.customers,
      products: db.products.filter((p) => p.active !== false),
      orders: db.orders,
      payments: db.payments,
      "outbox-events": db.events,
    };
    const item = lists[resource]?.find(
      (x) => (x as { id: string }).id === params.id,
    );
    return item ? HttpResponse.json(item) : notFound();
  }),
  http.get(`${API}/:resource`, async ({ params, request }) => {
    const e = await before();
    if (e) return e;
    const db = getDB(),
      u = new URL(request.url);
    const resource = String(params.resource);
    const lists: Record<string, unknown[]> = {
      customers: db.customers,
      products: db.products.filter((p) => p.active !== false),
      orders: db.orders,
      payments: db.payments,
      "outbox-events": db.events,
    };
    let list = lists[resource];
    if (!list) return notFound();
    const q = u.searchParams.get("q");
    if (q)
      list = list.filter((item) =>
        Object.values(item as object).some(
          (v) => typeof v === "string" && match(v, q),
        ),
      );
    for (const key of [
      "status",
      "customerId",
      "method",
      "orderId",
      "eventType",
    ]) {
      const v = u.searchParams.get(key);
      if (v)
        list = list.filter(
          (x) => String((x as Record<string, unknown>)[key]) === v,
        );
    }
    return HttpResponse.json(page(list, u));
  }),
  http.post(`${API}/:resource`, async ({ params, request }) => {
    const e = await before();
    if (e) return e;
    const resource = String(params.resource),
      data = await body(request);
    if (!data) return problem(400, "Invalid body");
    if (!["customers", "products", "orders", "payments"].includes(resource))
      return notFound();
    const errors = validate(resource, data);
    if (errors.length) return problem(400, "Invalid input", errors);
    const db = getDB();
    if (resource === "customers") {
      if (
        db.customers.some(
          (c) =>
            c.email.toLowerCase() === String(data.email).trim().toLowerCase(),
        )
      )
        return problem(409, "Email already exists");
      const c = {
        id: id(),
        firstName: String(data.firstName).trim(),
        lastName: String(data.lastName).trim(),
        email: String(data.email).trim(),
        phoneNumber: String(data.phoneNumber).trim(),
      };
      db.customers.unshift(c);
      saveDB();
      return HttpResponse.json(c, { status: 201 });
    }
    if (resource === "products") {
      const p = {
        id: id(),
        productName: String(data.productName),
        productDescription: String(data.productDescription),
        unitPrice: String(data.unitPrice),
        active: true,
      };
      db.products.unshift(p);
      saveDB();
      return HttpResponse.json(p, { status: 201 });
    }
    if (resource === "orders") {
      const customer = db.customers.find((c) => c.id === data.customerId);
      if (!customer)
        return problem(400, "Invalid customer", [
          { field: "customerId", message: "Customer not found" },
        ]);
      const items = data.items as { productId: string; quantity: number }[];
      if (
        items.some(
          (i) =>
            !i ||
            !Number.isSafeInteger(i.quantity) ||
            i.quantity <= 0 ||
            !db.products.some(
              (p) => p.id === i.productId && p.active !== false,
            ),
        )
      )
        return problem(400, "Invalid items", [
          {
            field: "items",
            message: "Choose available products and positive quantities",
          },
        ]);
      const order: Order = {
        id: id(),
        orderCode: String(data.orderCode),
        customerId: customer.id,
        customerName: `${customer.firstName} ${customer.lastName}`,
        status: "PENDING",
        createdAt: now(),
        items: items.map((i) => ({
          ...i,
          price: db.products.find((p) => p.id === i.productId)!.unitPrice,
        })),
        orderAmount: items
          .reduce(
            (sum, i) =>
              sum.plus(
                new Big(
                  db.products.find((p) => p.id === i.productId)!.unitPrice,
                ).times(i.quantity),
              ),
            new Big(0),
          )
          .toFixed(),
      };
      db.orders.unshift(order);
      saveDB();
      return HttpResponse.json(order, { status: 201 });
    }
    const order = db.orders.find((o) => o.id === data.orderId);
    if (!order) return notFound();
    if (
      db.payments.some((p) => p.orderId === order.id) ||
      order.status !== "PENDING"
    )
      return problem(409, "Order cannot be paid");
    const payment: Payment = {
      id: id(),
      orderId: order.id,
      status: "PENDING",
      method: String(data.method),
      amount: order.orderAmount,
      currency: "VND",
      createdAt: now(),
      updatedAt: now(),
    };
    db.payments.unshift(payment);
    order.status = "PAYMENT_PROCESSING";
    db.history[payment.id] = [
      {
        status: "PENDING",
        changedAt: payment.createdAt,
        source: "SYSTEM",
      } as PaymentHistory,
    ];
    eventFor(payment);
    saveDB();
    return HttpResponse.json(payment, { status: 201 });
  }),
  http.put(`${API}/:resource/:id`, async ({ params, request }) => {
    const e = await before();
    if (e) return e;
    const db = getDB(),
      r = String(params.resource),
      data = await body(request);
    if (!data) return problem(400, "Invalid body");
    if (!["customers", "products", "orders"].includes(r)) return notFound();
    const list =
      r === "customers"
        ? db.customers
        : r === "products"
          ? db.products
          : db.orders;
    const item = list.find((x) => x.id === params.id);
    if (!item) return notFound();
    if (r === "orders" && db.payments.some((p) => p.orderId === item.id))
      return problem(409, "Order is locked");
    const errors = validate(r, data);
    if (errors.length) return problem(400, "Invalid input", errors);
    if (
      r === "customers" &&
      db.customers.some(
        (c) =>
          c.id !== item.id &&
          c.email.toLowerCase() === String(data.email).trim().toLowerCase(),
      )
    )
      return problem(409, "Email already exists");
    if (r === "orders") {
      const customer = db.customers.find((c) => c.id === data.customerId);
      const items = data.items as { productId: string; quantity: number }[];
      if (
        !customer ||
        items.some(
          (i) =>
            !i ||
            !Number.isSafeInteger(i.quantity) ||
            i.quantity <= 0 ||
            !db.products.some(
              (p) => p.id === i.productId && p.active !== false,
            ),
        )
      )
        return problem(400, "Invalid order references", [
          {
            field: "items",
            message: "Choose available products and positive quantities",
          },
        ]);
      Object.assign(item, {
        orderCode: String(data.orderCode),
        customerId: customer.id,
        customerName: `${customer.firstName} ${customer.lastName}`,
        items: items.map((i) => ({
          ...i,
          price: db.products.find((p) => p.id === i.productId)!.unitPrice,
        })),
        orderAmount: items
          .reduce(
            (sum, i) =>
              sum.plus(
                new Big(
                  db.products.find((p) => p.id === i.productId)!.unitPrice,
                ).times(i.quantity),
              ),
            new Big(0),
          )
          .toFixed(),
      });
    } else {
      for (const key of r === "customers"
        ? ["firstName", "lastName", "email", "phoneNumber"]
        : ["productName", "productDescription", "unitPrice"])
        Object.assign(item, { [key]: String(data[key]).trim() });
    }
    saveDB();
    return HttpResponse.json(item);
  }),
  http.delete(`${API}/:resource/:id`, async ({ params }) => {
    const e = await before();
    if (e) return e;
    const db = getDB(),
      r = String(params.resource);
    if (!["customers", "products", "orders"].includes(r)) return notFound();
    const list =
      r === "customers"
        ? db.customers
        : r === "products"
          ? db.products
          : db.orders;
    const index = list.findIndex((x) => x.id === params.id);
    if (index < 0) return notFound();
    if (r === "orders" && db.payments.some((p) => p.orderId === params.id))
      return problem(409, "Order is locked");
    if (r === "products") db.products[index].active = false;
    else list.splice(index, 1);
    saveDB();
    return new HttpResponse(null, { status: 204 });
  }),
];
