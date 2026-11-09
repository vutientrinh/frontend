import Big from "big.js";
import { http, HttpResponse } from "msw";
import type {
  CheckoutRequest,
  CheckoutResult,
  OrderAction,
  OnboardingStep,
  PaymentIntent,
  ProductDetail,
  ProductWrite,
  SellerOrderDetail,
  SellerOrderStatus,
  SellerOrderTab,
  ShopperOrderTab,
} from "../../features/commerce/types";
import { getDB, saveDB } from "./db";
import { identity, bankingData } from "./auth";
import { SELLER_USER_IDS } from "./seed";
import { paymentPort } from "./paymentPort";
const API = new URL("/api", location.origin).href;
const path = (value: string) => `${API}${value}`;
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const money = (value: Big.BigSource) => new Big(value).toFixed(0);
const bad = (status: number, detail: string) =>
  HttpResponse.json(
    {
      status,
      title: status === 404 ? "Not Found" : "Invalid request",
      detail,
      fieldErrors:
        status === 422 ? [{ field: "request", message: detail }] : [],
    },
    { status },
  );
const body = async <T>(request: Request) => (await request.json()) as T;
const page = <T>(items: T[], url: URL) => {
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
};
const catalogProduct = (product: ProductDetail) => ({
  ...product,
  variantCount: product.variants.length,
  inStock: product.variants.some((variant) => variant.stock > 0),
});
const shopperTabs: Record<ShopperOrderTab, SellerOrderStatus[]> = {
  TO_PAY: ["PENDING_PAYMENT"],
  TO_SHIP: ["PAID", "CONFIRMED", "PACKED"],
  SHIPPING: ["SHIPPED"],
  DELIVERED: ["DELIVERED", "COMPLETED"],
  RETURNS: ["RETURN_REQUESTED", "RETURNED", "REFUNDED"],
  CANCELLED: ["CANCELLED"],
};
const sellerTabs: Record<SellerOrderTab, SellerOrderStatus[]> = {
  TO_CONFIRM: ["PAID"],
  TO_PACK: ["CONFIRMED"],
  READY_TO_SHIP: ["PACKED"],
  SHIPPING: ["SHIPPED"],
  DELIVERED: ["DELIVERED", "COMPLETED"],
  CANCELLED: ["CANCELLED"],
  RETURNS: ["RETURN_REQUESTED", "RETURNED", "REFUNDED"],
};
function actions(status: SellerOrderStatus): OrderAction[] {
  if (status === "PENDING_PAYMENT") return ["PAY", "CANCEL"];
  if (["PAID", "CONFIRMED", "PACKED"].includes(status)) return ["CANCEL"];
  if (status === "SHIPPED") return ["TRACK"];
  if (status === "DELIVERED") return ["CONFIRM_RECEIVED", "RETURN", "TRACK"];
  return [];
}
function transition(
  order: SellerOrderDetail,
  status: SellerOrderStatus,
  note?: string,
) {
  order.status = status;
  order.actions = actions(status);
  order.timeline.push({ status, at: now(), ...(note ? { note } : {}) });
}
function settle(
  intent: PaymentIntent,
  status: "SUCCEEDED" | "FAILED" | "EXPIRED" | "CANCELLED",
  reason?: string,
) {
  if (!["CREATED", "PROCESSING", "REQUIRES_ACTION"].includes(intent.status))
    return false;
  intent.status = status;
  if (reason) intent.failureReason = reason;
  for (const order of getDB().orders.filter(
    (o) => o.payment.intentId === intent.id,
  )) {
    order.payment.status = status;
    if (status === "SUCCEEDED") {
      order.payment.paidAt = now();
      transition(order, "PAID");
    } else if (status === "EXPIRED") {
      transition(order, "CANCELLED");
      for (const item of order.items) {
        const variant = getDB()
          .products.flatMap((p) => p.variants)
          .find(
            (v) =>
              v.id === (item as typeof item & { variantId: string }).variantId,
          );
        if (variant) variant.stock += item.quantity;
      }
    }
  }
  saveDB();
  return true;
}
function expire() {
  let changed = false;
  for (const product of getDB().products) {
    const review = product as ProductDetail & { reviewAt?: string };
    if (
      product.status === "PENDING_REVIEW" &&
      review.reviewAt &&
      Date.parse(review.reviewAt) <= Date.now()
    ) {
      product.status = "LIVE";
      delete review.reviewAt;
      changed = true;
    }
  }
  for (const order of getDB().orders) {
    const shipped = [...order.timeline]
      .reverse()
      .find((event) => event.status === "SHIPPED");
    if (
      order.status === "SHIPPED" &&
      shipped &&
      Date.parse(shipped.at) + 20000 <= Date.now()
    ) {
      transition(order, "DELIVERED");
      order.shipment?.events.push({
        status: "DELIVERED",
        at: now(),
        location: "Destination",
      });
      changed = true;
    }
  }
  if (changed) saveDB();
  for (const intent of getDB().intents)
    if (
      ["CREATED", "PROCESSING", "REQUIRES_ACTION"].includes(intent.status) &&
      Date.parse(intent.expiresAt) <= Date.now()
    )
      settle(intent, "EXPIRED");
  for (const order of getDB().orders) {
    const intent = getDB().intents.find((i) => i.id === order.payment.intentId);
    if (
      order.status === "PENDING_PAYMENT" &&
      intent &&
      Date.parse(intent.expiresAt) <= Date.now()
    ) {
      intent.status = "EXPIRED";
      order.payment.status = "EXPIRED";
      transition(order, "CANCELLED", "Reservation expired");
      for (const item of order.items) {
        const variant = getDB()
          .products.flatMap((p) => p.variants)
          .find(
            (v) =>
              v.id === (item as typeof item & { variantId: string }).variantId,
          );
        if (variant) variant.stock += item.quantity;
      }
      saveDB();
    }
  }
}
function cart(ownerId: string) {
  const db = getDB();
  const groups = db.sellers
    .map((seller) => ({
      seller,
      items: db.cart
        .filter(
          (i) =>
            i.ownerId === ownerId &&
            db.products.some(
              (p) => p.seller.id === seller.id && p.slug === i.productSlug,
            ),
        )
        .map((item) => {
          const product = db.products.find((p) => p.slug === item.productSlug);
          const variant = product?.variants.find(
            (v) => v.id === item.variantId,
          );
          return {
            ...item,
            stock: variant?.stock ?? 0,
            maxQuantity: variant?.stock ?? 0,
            available: !!variant && product?.status === "LIVE",
          };
        }),
    }))
    .filter((g) => g.items.length);
  const selected = groups.flatMap((g) => g.items).filter((i) => i.selected);
  return {
    groups,
    selectedCount: selected.reduce((sum, i) => sum + i.quantity, 0),
    selectedSubtotal: selected
      .reduce(
        (sum, i) => sum.plus(new Big(i.unitPrice).times(i.quantity)),
        new Big(0),
      )
      .toFixed(0),
  };
}
function quote(
  ownerId: string,
  ids: string[],
  shipping: Record<string, string> = {},
) {
  const groups = cart(ownerId)
    .groups.map((group) => {
      const items = group.items.filter((i) => ids.includes(i.id));
      const subtotal = items.reduce(
        (sum, i) => sum.plus(new Big(i.unitPrice).times(i.quantity)),
        new Big(0),
      );
      const shippingOptions = [
        { id: "standard", name: "Standard", fee: "25000", etaDays: 3 },
        { id: "express", name: "Express", fee: "40000", etaDays: 1 },
      ];
      const selectedShippingOptionId = shipping[group.seller.id] ?? "standard";
      const shippingFee =
        shippingOptions.find((o) => o.id === selectedShippingOptionId)?.fee ??
        "25000";
      return {
        ...group,
        items,
        subtotal: money(subtotal),
        shippingOptions,
        selectedShippingOptionId,
        shippingFee,
      };
    })
    .filter((g) => g.items.length);
  const itemsTotal = groups.reduce((s, g) => s.plus(g.subtotal), new Big(0));
  const shippingTotal = groups.reduce(
    (s, g) => s.plus(g.shippingFee),
    new Big(0),
  );
  return {
    groups,
    itemsTotal: money(itemsTotal),
    shippingTotal: money(shippingTotal),
    discount: "0",
    total: money(itemsTotal.plus(shippingTotal)),
    walletAvailable: "0",
    warnings: [] as string[],
  };
}
const normalized = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
const validProduct = (input: ProductWrite) =>
  typeof input.name === "string" &&
  !!input.name.trim() &&
  Array.isArray(input.images) &&
  Array.isArray(input.attributes) &&
  Array.isArray(input.options) &&
  Array.isArray(input.variants) &&
  input.variants.length > 0 &&
  input.variants.every(
    (v) =>
      typeof v.sku === "string" &&
      !!v.sku.trim() &&
      /^\d+$/.test(v.price) &&
      new Big(v.price).gt(0) &&
      (v.compareAtPrice === undefined || /^\d+$/.test(v.compareAtPrice)) &&
      Number.isInteger(v.stock) &&
      v.stock >= 0 &&
      Number.isInteger(v.weightGrams) &&
      v.weightGrams > 0,
  );
const owner = (request: Request) => identity(request)!;
const sellerId = (request: Request) =>
  getDB().sellers[
    SELLER_USER_IDS.indexOf(
      owner(request).id as (typeof SELLER_USER_IDS)[number],
    )
  ]?.id;
const belongs = (
  request: Request,
  order: SellerOrderDetail & { ownerId: string },
) =>
  order.ownerId === owner(request).id ||
  order.ownerId === `phone:${owner(request).phone}`;
const guard =
  (kind: "shopper" | "seller") =>
  ({ request }: { request: Request }) => {
    const user = identity(request);
    if (!user) return bad(401, "Authentication required");
    if (
      kind === "shopper"
        ? !user.roles.includes("SHOPPER")
        : !user.roles.some(
            (r) => r === "SELLER_OWNER" || r === "SELLER_STAFF",
          ) ||
          !SELLER_USER_IDS.includes(user.id as (typeof SELLER_USER_IDS)[number])
    )
      return bad(403, "Forbidden");
  };
export const commerceHandlers = [
  http.all(path("/cart"), guard("shopper")),
  http.all(path("/cart/*"), guard("shopper")),
  http.all(path("/checkout"), guard("shopper")),
  http.all(path("/checkout/*"), guard("shopper")),
  http.all(path("/payment-intents/*"), guard("shopper")),
  http.all(path("/dev/payment-intents/*"), guard("shopper")),
  http.all(path("/me/orders"), guard("shopper")),
  http.all(path("/me/orders/*"), guard("shopper")),
  http.all(path("/seller/*"), guard("seller")),
  http.all(path("/dev/seller/*"), guard("seller")),
  http.get(path("/catalog/categories"), () =>
    HttpResponse.json(getDB().categories),
  ),
  http.get(path("/catalog/home"), () => {
    expire();
    const db = getDB();
    const products = db.products
      .filter((p) => p.status === "LIVE")
      .map(catalogProduct);
    return HttpResponse.json({
      banners: [],
      deals: products.filter((p) => p.compareAtPrice).slice(0, 8),
      recommended: products.slice(0, 12),
      categories: db.categories,
    });
  }),
  http.get(path("/catalog/products"), ({ request }) => {
    expire();
    const u = new URL(request.url);
    let items = getDB().products.filter((p) => p.status === "LIVE");
    const q = u.searchParams.get("q")?.toLowerCase();
    if (q) items = items.filter((p) => p.name.toLowerCase().includes(q));
    const category = u.searchParams.get("category");
    if (category)
      items = items.filter(
        (p) =>
          p.category.slug === category ||
          getDB().categories.some(
            (c) =>
              c.slug === p.category.slug &&
              getDB().categories.some(
                (parent) =>
                  parent.id === c.parentId && parent.slug === category,
              ),
          ),
      );
    const seller = u.searchParams.get("sellerSlug");
    if (seller) items = items.filter((p) => p.seller.slug === seller);
    for (const [param, compare] of [
      ["minPrice", (a: Big, b: string) => a.gte(b)],
      ["maxPrice", (a: Big, b: string) => a.lte(b)],
      ["minRating", (a: Big, b: string) => a.gte(b)],
    ] as const) {
      const value = u.searchParams.get(param);
      if (value && /^\d+(\.\d+)?$/.test(value))
        items = items.filter((p) =>
          compare(new Big(param === "minRating" ? p.rating : p.price), value),
        );
    }
    const sort = u.searchParams.get("sort");
    if (sort === "price_asc" || sort === "price_desc")
      items.sort(
        (a, b) =>
          new Big(a.price).cmp(b.price) * (sort === "price_asc" ? 1 : -1),
      );
    if (sort === "best_selling")
      items.sort((a, b) => b.soldCount - a.soldCount);
    if (sort === "newest") items.reverse();
    return HttpResponse.json(page(items.map(catalogProduct), u));
  }),
  http.get(path("/catalog/products/:slug"), ({ params }) => {
    expire();
    const product = getDB().products.find(
      (p) => p.slug === params.slug && p.status === "LIVE",
    );
    return product
      ? HttpResponse.json(catalogProduct(product))
      : bad(404, "Product not found");
  }),
  http.get(path("/catalog/sellers/:slug"), ({ params }) => {
    const seller = getDB().sellers.find((s) => s.slug === params.slug);
    return seller
      ? HttpResponse.json({
          ...seller,
          description: "Independent marketplace seller",
          logoUrl: "",
          bannerUrl: "",
          productCount: getDB().products.filter(
            (p) => p.seller.id === seller.id && p.status === "LIVE",
          ).length,
          joinedAt: "2026-01-01T00:00:00Z",
          responseRate: "98",
        })
      : bad(404, "Seller not found");
  }),
  http.get(path("/cart"), ({ request }) => {
    expire();
    return HttpResponse.json(cart(owner(request).id));
  }),
  http.post(path("/cart/items"), async ({ request }) => {
    expire();
    const input = await body<{ variantId: string; quantity: number }>(request);
    const product = getDB().products.find(
      (p) =>
        p.status === "LIVE" && p.variants.some((v) => v.id === input.variantId),
    );
    const variant = product?.variants.find((v) => v.id === input.variantId);
    if (!product || !variant) return bad(404, "Variant not found");
    const existing = getDB().cart.find(
      (i) => i.ownerId === owner(request).id && i.variantId === variant.id,
    );
    const quantity = input.quantity + (existing?.quantity ?? 0);
    if (
      !Number.isInteger(input.quantity) ||
      input.quantity < 1 ||
      quantity > variant.stock
    )
      return bad(422, "Quantity exceeds available stock or is invalid");
    if (existing) existing.quantity = quantity;
    else
      getDB().cart.push({
        id: id(),
        ownerId: owner(request).id,
        variantId: variant.id,
        productSlug: product.slug,
        name: product.name,
        variantLabel: Object.values(variant.options).join(" / "),
        imageUrl: product.imageUrl,
        unitPrice: variant.price,
        quantity,
        stock: variant.stock,
        maxQuantity: variant.stock,
        selected: true,
        available: true,
      });
    saveDB();
    return HttpResponse.json(cart(owner(request).id));
  }),
  http.patch(path("/cart/items/:id"), async ({ request, params }) => {
    expire();
    const item = getDB().cart.find(
      (i) => i.id === params.id && i.ownerId === owner(request).id,
    );
    if (!item) return bad(404, "Cart item not found");
    const input = await body<{ quantity?: number; selected?: boolean }>(
      request,
    );
    const variant = getDB()
      .products.flatMap((p) => p.variants)
      .find((v) => v.id === item.variantId);
    if (
      input.quantity !== undefined &&
      (!Number.isInteger(input.quantity) ||
        input.quantity < 1 ||
        input.quantity > (variant?.stock ?? 0))
    )
      return bad(422, "Quantity exceeds available stock or is invalid");
    if (input.quantity !== undefined) item.quantity = input.quantity;
    if (input.selected !== undefined) item.selected = input.selected;
    saveDB();
    return HttpResponse.json(cart(owner(request).id));
  }),
  http.delete(path("/cart/items/:id"), ({ params, request }) => {
    const db = getDB();
    if (
      !db.cart.some(
        (i) => i.id === params.id && i.ownerId === owner(request).id,
      )
    )
      return bad(404, "Cart item not found");
    db.cart = db.cart.filter(
      (i) => i.id !== params.id || i.ownerId !== owner(request).id,
    );
    saveDB();
    return HttpResponse.json(cart(owner(request).id));
  }),
  http.post(path("/checkout/quote"), async ({ request }) => {
    expire();
    const input = await body<{
      cartItemIds: string[];
      shippingOptionIds?: Record<string, string>;
    }>(request);
    const q = quote(
      owner(request).id,
      input.cartItemIds,
      input.shippingOptionIds,
    );
    q.walletAvailable = await paymentPort.available(owner(request).id);
    return HttpResponse.json(q);
  }),
  http.post(path("/checkout"), async ({ request }) => {
    expire();
    const input = await body<CheckoutRequest>(request);
    const db = getDB();
    const rawKey = request.headers.get("Idempotency-Key");
    const key = rawKey ? `${owner(request).id}:checkout:${rawKey}` : null;
    if (!key) return bad(400, "Idempotency-Key is required");
    const serialized = JSON.stringify(input);
    const previous = db.keys[key];
    if (previous)
      return previous.body === serialized
        ? HttpResponse.json(previous.result as CheckoutResult)
        : bad(409, "Idempotency key already used");
    if (
      !input.cartItemIds?.length ||
      new Set(input.cartItemIds).size !== input.cartItemIds.length ||
      !input.addressId ||
      !["WALLET", "VIETQR"].includes(input.paymentMethod)
    )
      return bad(422, "Invalid checkout");
    const q = quote(
      owner(request).id,
      input.cartItemIds,
      input.shippingOptionIds,
    );
    const items = q.groups.flatMap((g) => g.items);
    if (
      items.length !== input.cartItemIds.length ||
      items.some((i) => !i.available || i.quantity > i.maxQuantity) ||
      q.groups.some(
        (g) =>
          !g.shippingOptions.some(
            (o) => o.id === input.shippingOptionIds?.[g.seller.id],
          ),
      )
    )
      return bad(422, "Items or shipping options are unavailable");
    const selectedAddress = bankingData()?.addresses[owner(request).id]?.find(
      (a) => a.id === input.addressId,
    ) ?? {
      recipient: owner(request).fullName,
      phone: owner(request).phone,
      address: "Ho Chi Minh City",
    };
    const parentOrderId = id();
    const orderNumber = `ORD-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${String(db.orders.length + 1).padStart(4, "0")}`;
    const intent: PaymentIntent = {
      id: id(),
      parentOrderId,
      orderNumber,
      method: input.paymentMethod,
      status:
        input.paymentMethod === "WALLET" && new Big(q.total).gt(2000000)
          ? "REQUIRES_ACTION"
          : "CREATED",
      amount: q.total,
      expiresAt: new Date(Date.now() + 900000).toISOString(),
      ...(input.paymentMethod === "VIETQR"
        ? {
            reference: orderNumber,
            qrPayload: `MOCK:${orderNumber}:${q.total}`,
          }
        : {}),
      ...(input.paymentMethod === "WALLET" && new Big(q.total).gt(2000000)
        ? { otpRequired: true, otpId: id() }
        : {}),
    };
    db.intents.push(intent);
    const orders = q.groups.map((g, index) => {
      const total = money(new Big(g.subtotal).plus(g.shippingFee));
      const commission = money(new Big(g.subtotal).times("0.05"));
      const vat = money(new Big(commission).times("0.1"));
      const order: SellerOrderDetail & { ownerId: string } = {
        ownerId: owner(request).id,
        id: id(),
        orderNumber: `${orderNumber}-${String.fromCharCode(65 + index)}`,
        parentOrderId,
        paymentIntentId: intent.id,
        seller: g.seller,
        status: "PENDING_PAYMENT",
        itemsPreview: g.items.map(
          ({ name, imageUrl, variantLabel, quantity }) => ({
            name,
            imageUrl,
            variantLabel,
            quantity,
          }),
        ),
        itemCount: g.items.reduce((n, item) => n + item.quantity, 0),
        total,
        createdAt: now(),
        actions: ["PAY", "CANCEL"],
        items: g.items.map((item) => ({
          variantId: item.variantId,
          name: item.name,
          imageUrl: item.imageUrl,
          variantLabel: item.variantLabel,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: money(new Big(item.unitPrice).times(item.quantity)),
        })),
        shippingAddress: {
          recipient: selectedAddress.recipient,
          phone: selectedAddress.phone,
          address: selectedAddress.address,
        },
        shippingFee: g.shippingFee,
        discount: "0",
        payment: {
          intentId: intent.id,
          method: intent.method,
          status: intent.status,
        },
        timeline: [{ status: "PENDING_PAYMENT", at: now() }],
        buyer: { maskedName: "D*** Shopper", maskedPhone: "090****001" },
        money: {
          gross: g.subtotal,
          commission,
          vatOnCommission: vat,
          net: money(new Big(g.subtotal).minus(commission).minus(vat)),
          escrowStatus: "PENDING",
        },
      };
      return order;
    });
    for (const item of items) {
      const variant = db.products
        .flatMap((p) => p.variants)
        .find((v) => v.id === item.variantId)!;
      variant.stock -= item.quantity;
    }
    db.orders.push(...orders);
    db.cart = db.cart.filter(
      (i) =>
        i.ownerId !== owner(request).id || !input.cartItemIds.includes(i.id),
    );
    const result = {
      parentOrderId,
      orderNumber,
      sellerOrders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        seller: o.seller,
        total: o.total,
      })),
      paymentIntent: intent,
    };
    db.keys[key] = { body: serialized, result };
    saveDB();
    if (intent.method === "WALLET" && intent.status === "CREATED") {
      intent.status = "PROCESSING";
      const result = await paymentPort.charge(
        owner(request).id,
        intent.amount,
        {
          intentId: intent.id,
          parentOrderId,
        },
      );
      settle(
        intent,
        result.ok ? "SUCCEEDED" : "FAILED",
        result.ok ? undefined : result.reason,
      );
    }
    saveDB();
    return HttpResponse.json(result);
  }),
  http.get(path("/payment-intents/:id"), ({ params, request }) => {
    expire();
    const intent = getDB().intents.find(
      (i) =>
        i.id === params.id &&
        getDB().orders.some(
          (o) => o.payment.intentId === i.id && belongs(request, o),
        ),
    );
    return intent
      ? HttpResponse.json(intent)
      : bad(404, "Payment intent not found");
  }),
  http.post(
    path("/payment-intents/:id/confirm"),
    async ({ request, params }) => {
      expire();
      const intent = getDB().intents.find(
        (i) =>
          i.id === params.id &&
          getDB().orders.some(
            (o) => o.payment.intentId === i.id && belongs(request, o),
          ),
      );
      if (!intent) return bad(404, "Payment intent not found");
      const input = await body<{ otpId: string; code: string }>(request);
      const key = request.headers.get("Idempotency-Key");
      if (!key) return bad(400, "Idempotency-Key is required");
      const scopedKey = `${owner(request).id}:confirm:${key}`;
      const previous = getDB().keys[scopedKey];
      if (previous)
        return previous.body === JSON.stringify(input)
          ? HttpResponse.json(previous.result as PaymentIntent)
          : bad(409, "Idempotency key already used");
      if (
        intent.status !== "REQUIRES_ACTION" ||
        input.otpId !== intent.otpId ||
        input.code !== "123456"
      )
        return bad(422, "Invalid OTP or payment state");
      const order = getDB().orders.find(
        (o) => o.payment.intentId === intent.id,
      )!;
      intent.status = "PROCESSING";
      getDB().keys[scopedKey] = { body: JSON.stringify(input), result: intent };
      saveDB();
      const result = await paymentPort.charge(
        owner(request).id,
        intent.amount,
        {
          intentId: intent.id,
          parentOrderId: order.parentOrderId,
        },
      );
      settle(
        intent,
        result.ok ? "SUCCEEDED" : "FAILED",
        result.ok ? undefined : result.reason,
      );
      getDB().keys[scopedKey] = {
        body: JSON.stringify(input),
        result: { ...intent },
      };
      saveDB();
      return HttpResponse.json(intent);
    },
  ),
  http.post(path("/payment-intents/:id/cancel"), ({ params, request }) => {
    expire();
    const intent = getDB().intents.find(
      (i) =>
        i.id === params.id &&
        getDB().orders.some(
          (o) => o.payment.intentId === i.id && belongs(request, o),
        ),
    );
    if (!intent) return bad(404, "Payment intent not found");
    return settle(intent, "CANCELLED")
      ? HttpResponse.json(intent)
      : bad(409, "Payment is already terminal");
  }),
  http.post(
    path("/dev/payment-intents/:id/simulate"),
    async ({ params, request }) => {
      expire();
      const intent = getDB().intents.find(
        (i) =>
          i.id === params.id &&
          getDB().orders.some(
            (o) => o.payment.intentId === i.id && belongs(request, o),
          ),
      );
      if (!intent) return bad(404, "Payment intent not found");
      const input = await body<{ outcome: "SUCCEEDED" | "FAILED" }>(request);
      if (!["SUCCEEDED", "FAILED"].includes(input.outcome))
        return bad(422, "Invalid outcome");
      return settle(
        intent,
        input.outcome,
        input.outcome === "FAILED" ? "Simulated failure" : undefined,
      )
        ? HttpResponse.json(intent)
        : bad(409, "Payment is already terminal");
    },
  ),
  http.get(path("/me/orders"), ({ request }) => {
    expire();
    const u = new URL(request.url);
    const tab = u.searchParams.get("tab") as ShopperOrderTab | null;
    return HttpResponse.json(
      page(
        getDB().orders.filter(
          (o) =>
            belongs(request, o) &&
            (!tab || shopperTabs[tab]?.includes(o.status)),
        ),
        u,
      ),
    );
  }),
  http.get(path("/me/orders/:id"), ({ params, request }) => {
    expire();
    const order = getDB().orders.find(
      (o) => o.id === params.id && belongs(request, o),
    );
    return order ? HttpResponse.json(order) : bad(404, "Order not found");
  }),
  http.post(path("/me/orders/:id/pay"), async ({ params, request }) => {
    expire();
    const input = await body<{ paymentMethod: "WALLET" | "VIETQR" }>(request);
    const key = request.headers.get("Idempotency-Key");
    if (!key) return bad(400, "Idempotency-Key is required");
    const scopedKey = `${owner(request).id}:pay:${key}`;
    const serialized = JSON.stringify({ parentOrderId: params.id, ...input });
    const previous = getDB().keys[scopedKey];
    if (previous)
      return previous.body === serialized
        ? HttpResponse.json(previous.result as PaymentIntent)
        : bad(409, "Idempotency key already used");
    if (!["WALLET", "VIETQR"].includes(input.paymentMethod))
      return bad(422, "Invalid payment method");
    const orders = getDB().orders.filter(
      (o) => o.parentOrderId === params.id && belongs(request, o),
    );
    if (!orders.length) return bad(404, "Order not found");
    const old = getDB().intents.find(
      (i) => i.id === orders[0].payment.intentId,
    );
    if (
      !old ||
      orders.some((o) => o.status !== "PENDING_PAYMENT") ||
      Date.parse(old.expiresAt) <= Date.now() ||
      ["CREATED", "PROCESSING", "REQUIRES_ACTION"].includes(old.status)
    )
      return bad(409, "Payment cannot be retried");
    const amount = orders
      .reduce((sum, order) => sum.plus(order.total), new Big(0))
      .toFixed(0);
    const requiresOtp =
      input.paymentMethod === "WALLET" && new Big(amount).gt(2000000);
    const intent: PaymentIntent = {
      id: id(),
      parentOrderId: orders[0].parentOrderId,
      orderNumber: old.orderNumber,
      method: input.paymentMethod,
      status: requiresOtp ? "REQUIRES_ACTION" : "CREATED",
      amount,
      expiresAt: old.expiresAt,
      ...(requiresOtp ? { otpRequired: true, otpId: id() } : {}),
      ...(input.paymentMethod === "VIETQR"
        ? {
            reference: old.orderNumber,
            qrPayload: `MOCK:${old.orderNumber}:${amount}`,
          }
        : {}),
    };
    getDB().intents.push(intent);
    for (const order of orders) {
      order.paymentIntentId = intent.id;
      order.payment = {
        intentId: intent.id,
        method: intent.method,
        status: intent.status,
      };
    }
    getDB().keys[scopedKey] = { body: serialized, result: intent };
    saveDB();
    if (intent.method === "WALLET" && !requiresOtp) {
      intent.status = "PROCESSING";
      const result = await paymentPort.charge(owner(request).id, amount, {
        intentId: intent.id,
        parentOrderId: intent.parentOrderId,
      });
      settle(
        intent,
        result.ok ? "SUCCEEDED" : "FAILED",
        result.ok ? undefined : result.reason,
      );
    }
    return HttpResponse.json(intent);
  }),
  http.post(path("/me/orders/:id/:action"), async ({ params, request }) => {
    expire();
    const order = getDB().orders.find(
      (o) => o.id === params.id && belongs(request, o),
    );
    if (!order) return bad(404, "Order not found");
    if (
      params.action === "cancel" &&
      ["PENDING_PAYMENT", "PAID", "CONFIRMED", "PACKED"].includes(order.status)
    ) {
      const input = await body<{ reason: string }>(request);
      if (!input.reason?.trim()) return bad(422, "Reason required");
      if (order.status === "PENDING_PAYMENT") {
        const intent = getDB().intents.find(
          (i) => i.id === order.payment.intentId,
        );
        if (intent) settle(intent, "CANCELLED");
        for (const sibling of getDB().orders.filter(
          (o) =>
            o.parentOrderId === order.parentOrderId &&
            o.status === "PENDING_PAYMENT",
        )) {
          transition(sibling, "CANCELLED", input.reason);
          for (const item of sibling.items) {
            const variant = getDB()
              .products.flatMap((p) => p.variants)
              .find(
                (v) =>
                  v.id ===
                  (item as typeof item & { variantId: string }).variantId,
              );
            if (variant) variant.stock += item.quantity;
          }
        }
      } else {
        transition(order, "CANCELLED", input.reason);
        for (const item of order.items) {
          const variant = getDB()
            .products.flatMap((p) => p.variants)
            .find(
              (v) =>
                v.id ===
                (item as typeof item & { variantId: string }).variantId,
            );
          if (variant) variant.stock += item.quantity;
        }
      }
    } else if (
      params.action === "confirm-received" &&
      order.status === "DELIVERED"
    )
      transition(order, "COMPLETED");
    else return bad(409, "Action is not valid for this order");
    saveDB();
    return HttpResponse.json(order);
  }),
  http.get(path("/seller/onboarding"), ({ request }) =>
    HttpResponse.json(getDB().onboarding[sellerId(request)!]),
  ),
  http.put(path("/seller/onboarding/:step"), async ({ params, request }) => {
    const step = params.step as OnboardingStep;
    const steps: OnboardingStep[] = [
      "shop",
      "owner",
      "documents",
      "bank",
      "terms",
    ];
    if (!steps.includes(step)) return bad(404, "Step not found");
    const onboarding = getDB().onboarding[sellerId(request)!];
    if (!["DRAFT", "REJECTED"].includes(onboarding.status))
      return bad(409, "Application cannot be edited");
    const input = await body<Record<string, unknown>>(request);
    const required: Record<OnboardingStep, string[]> = {
      shop: [
        "shopName",
        "slug",
        "description",
        "location",
        "contactPhone",
        "contactEmail",
      ],
      owner: [
        "fullName",
        "dateOfBirth",
        "idNumber",
        "idFrontImage",
        "idBackImage",
      ],
      documents: ["businessType"],
      bank: ["bankName", "accountNumber", "accountHolder"],
      terms: ["acceptedCommissionPlan", "acceptedAt"],
    };
    if (
      required[step].some(
        (field) =>
          typeof input[field] !== "string" || !String(input[field]).trim(),
      ) ||
      (step === "documents" &&
        (!Array.isArray(input.documentNames) ||
          !["INDIVIDUAL", "HOUSEHOLD", "COMPANY"].includes(
            String(input.businessType),
          ))) ||
      (step === "terms" && input.acceptedCommissionPlan !== "STANDARD_5")
    )
      return bad(422, "Complete all required fields");
    if (
      step === "bank" &&
      normalized(String(input.accountHolder ?? "")) !==
        normalized(onboarding.steps.owner?.fullName ?? "")
    )
      return bad(422, "Account holder must match owner name");
    if (step === "owner") {
      input.idFrontImage = String(input.idFrontImage ?? "").startsWith("data:")
        ? "uploaded-front"
        : input.idFrontImage;
      input.idBackImage = String(input.idBackImage ?? "").startsWith("data:")
        ? "uploaded-back"
        : input.idBackImage;
    }
    Object.assign(onboarding.steps, { [step]: input });
    onboarding.currentStep =
      steps[Math.min(steps.indexOf(step) + 1, steps.length - 1)];
    saveDB();
    return HttpResponse.json(onboarding);
  }),
  http.post(path("/seller/onboarding/submit"), ({ request }) => {
    const application = getDB().onboarding[sellerId(request)!];
    if (
      !["DRAFT", "REJECTED"].includes(application.status) ||
      !["shop", "owner", "documents", "bank", "terms"].every(
        (step) => step in application.steps,
      )
    )
      return bad(422, "Complete all steps first");
    application.status = "UNDER_REVIEW";
    saveDB();
    return HttpResponse.json(application);
  }),
  http.post(path("/dev/seller/onboarding/approve"), ({ request }) => {
    const application = getDB().onboarding[sellerId(request)!];
    if (application.status !== "UNDER_REVIEW")
      return bad(409, "Application is not under review");
    application.status = "APPROVED";
    saveDB();
    return HttpResponse.json(application);
  }),
  http.get(path("/seller/dashboard"), ({ request }) => {
    expire();
    const db = getDB();
    const orders = db.orders.filter((o) => o.seller.id === sellerId(request));
    const count = (status: SellerOrderStatus) =>
      orders.filter((o) => o.status === status).length;
    const eligible = orders.filter(
      (o) => !["PENDING_PAYMENT", "CANCELLED"].includes(o.status),
    );
    const totals = (rows: typeof orders) => ({
      gross: rows
        .reduce((v, o) => v.plus(o.money.gross), new Big(0))
        .toFixed(0),
      net: rows.reduce((v, o) => v.plus(o.money.net), new Big(0)).toFixed(0),
    });
    const today = new Date().toISOString().slice(0, 10);
    return HttpResponse.json({
      toConfirm: count("PAID"),
      toPack: count("CONFIRMED"),
      readyToShip: count("PACKED"),
      revenueToday: totals(
        eligible.filter((o) => o.createdAt.slice(0, 10) === today),
      ),
      revenue30d: totals(
        eligible.filter(
          (o) => Date.parse(o.createdAt) >= Date.now() - 30 * 86400000,
        ),
      ),
      pendingEscrow: eligible
        .filter((o) => o.money.escrowStatus === "PENDING")
        .reduce((v, o) => v.plus(o.money.net), new Big(0))
        .toFixed(0),
      walletBalance: "0",
      lowStockCount: db.products
        .filter((p) => p.seller.id === sellerId(request))
        .flatMap((p) => p.variants)
        .filter((v) => v.stock < 5).length,
      cancelRate: "0",
      lateShipRate: "0",
      confirmDeadlines: orders
        .filter((o) => o.status === "PAID")
        .map((o) => ({
          orderId: o.id,
          orderNumber: o.orderNumber,
          dueAt: new Date(Date.parse(o.createdAt) + 86400000).toISOString(),
        })),
    });
  }),
  http.get(path("/seller/products"), ({ request }) => {
    expire();
    const u = new URL(request.url);
    const q = u.searchParams.get("q")?.toLowerCase();
    const status = u.searchParams.get("status");
    return HttpResponse.json(
      page(
        getDB()
          .products.filter(
            (p) =>
              p.seller.id === sellerId(request) &&
              (!q || p.name.toLowerCase().includes(q)) &&
              (!status || p.status === status),
          )
          .map((p) => ({
            ...p,
            variantCount: p.variants.length,
            totalStock: p.variants.reduce((sum, v) => sum + v.stock, 0),
          })),
        u,
      ),
    );
  }),
  http.post(path("/seller/products"), async ({ request }) => {
    const input = await body<ProductWrite>(request);
    const db = getDB();
    const category = db.categories.find((c) => c.slug === input.categorySlug);
    if (!category || !validProduct(input))
      return bad(422, "Name, category and variants are required");
    const variants = input.variants.map((v) => ({ ...v, id: v.id ?? id() }));
    const product: ProductDetail = {
      id: id(),
      slug: `product-${id()}`,
      name: input.name,
      imageUrl: input.images[0] ?? "",
      price: variants[0].price,
      rating: "0",
      ratingCount: 0,
      soldCount: 0,
      variantCount: variants.length,
      seller: db.sellers.find((s) => s.id === sellerId(request))!,
      inStock: variants.some((v) => v.stock > 0),
      description: input.description,
      images: input.images,
      attributes: input.attributes,
      options: input.options,
      variants,
      ...(input.shippingDimensions
        ? { shippingDimensions: input.shippingDimensions }
        : {}),
      category: { slug: category.slug, name: category.name },
      status: "DRAFT",
    };
    db.products.push(product);
    saveDB();
    return HttpResponse.json(product, { status: 201 });
  }),
  http.get(path("/seller/products/:id"), ({ params, request }) => {
    expire();
    const p = getDB().products.find(
      (p) => p.id === params.id && p.seller.id === sellerId(request),
    );
    return p ? HttpResponse.json(p) : bad(404, "Product not found");
  }),
  http.put(path("/seller/products/:id"), async ({ request, params }) => {
    const p = getDB().products.find(
      (p) => p.id === params.id && p.seller.id === sellerId(request),
    );
    if (!p) return bad(404, "Product not found");
    const input = await body<ProductWrite>(request);
    const category = getDB().categories.find(
      (c) => c.slug === input.categorySlug,
    );
    if (!category || !validProduct(input))
      return bad(422, "Name, category and variants are required");
    const variants = input.variants.map((v) => ({ ...v, id: v.id ?? id() }));
    Object.assign(p, {
      name: input.name,
      description: input.description,
      images: input.images,
      imageUrl: input.images[0] ?? "",
      attributes: input.attributes,
      options: input.options,
      variants,
      variantCount: variants.length,
      shippingDimensions: input.shippingDimensions,
      price: input.variants[0].price,
      category: { slug: category.slug, name: category.name },
    });
    saveDB();
    return HttpResponse.json(p);
  }),
  http.post(path("/seller/products/:id/:action"), ({ params, request }) => {
    const p = getDB().products.find(
      (p) => p.id === params.id && p.seller.id === sellerId(request),
    );
    if (!p) return bad(404, "Product not found");
    if (
      params.action === "submit" &&
      ["DRAFT", "REJECTED"].includes(p.status)
    ) {
      p.status = "PENDING_REVIEW";
      (p as ProductDetail & { reviewAt?: string }).reviewAt = new Date(
        Date.now() + 5000,
      ).toISOString();
    } else if (params.action === "hide" && p.status === "LIVE")
      p.status = "HIDDEN";
    else if (params.action === "unhide" && p.status === "HIDDEN")
      p.status = "LIVE";
    else return bad(409, "Invalid product action");
    saveDB();
    return HttpResponse.json(p);
  }),
  http.get(path("/seller/inventory"), ({ request }) => {
    expire();
    const u = new URL(request.url);
    const q = u.searchParams.get("q")?.toLowerCase();
    const rows = getDB()
      .products.filter((p) => p.seller.id === sellerId(request))
      .flatMap((p) =>
        p.variants.map((v) => {
          const reserved = getDB()
            .orders.filter((o) => o.status === "PENDING_PAYMENT")
            .flatMap((o) => o.items)
            .filter(
              (i) => (i as typeof i & { variantId: string }).variantId === v.id,
            )
            .reduce((sum, i) => sum + i.quantity, 0);
          return {
            variantId: v.id,
            sku: v.sku,
            productName: p.name,
            variantLabel: Object.values(v.options).join(" / "),
            onHand: v.stock + reserved,
            reserved,
            available: v.stock,
          };
        }),
      )
      .filter(
        (r) =>
          (!q || `${r.sku} ${r.productName}`.toLowerCase().includes(q)) &&
          (u.searchParams.get("lowStock") !== "true" || r.available < 5),
      );
    return HttpResponse.json(rows);
  }),
  http.post(
    path("/seller/inventory/:id/adjust"),
    async ({ params, request }) => {
      const variant = getDB()
        .products.filter((p) => p.seller.id === sellerId(request))
        .flatMap((p) => p.variants)
        .find((v) => v.id === params.id);
      if (!variant) return bad(404, "Variant not found");
      const input = await body<{ delta: number; reason: string }>(request);
      if (
        !Number.isInteger(input.delta) ||
        !input.delta ||
        !input.reason?.trim() ||
        variant.stock + input.delta < 0
      )
        return bad(422, "Invalid adjustment");
      variant.stock += input.delta;
      (getDB().movements[variant.id] ??= []).push({
        id: id(),
        delta: input.delta,
        reason: input.reason,
        at: now(),
      });
      saveDB();
      return HttpResponse.json(variant);
    },
  ),
  http.get(path("/seller/inventory/:id/movements"), ({ params, request }) => {
    if (
      !getDB().products.some(
        (p) =>
          p.seller.id === sellerId(request) &&
          p.variants.some((v) => v.id === params.id),
      )
    )
      return bad(404, "Variant not found");
    return HttpResponse.json(getDB().movements[String(params.id)] ?? []);
  }),
  http.get(path("/seller/orders"), ({ request }) => {
    expire();
    const u = new URL(request.url);
    const tab = u.searchParams.get("status") as SellerOrderTab | null;
    return HttpResponse.json(
      page(
        getDB().orders.filter(
          (o) =>
            o.seller.id === sellerId(request) &&
            (!tab || sellerTabs[tab]?.includes(o.status)),
        ),
        u,
      ),
    );
  }),
  http.get(path("/seller/orders/:id"), ({ params, request }) => {
    expire();
    const order = getDB().orders.find(
      (o) => o.id === params.id && o.seller.id === sellerId(request),
    );
    return order ? HttpResponse.json(order) : bad(404, "Order not found");
  }),
  http.post(path("/seller/orders/:id/:action"), async ({ params, request }) => {
    expire();
    const order = getDB().orders.find(
      (o) => o.id === params.id && o.seller.id === sellerId(request),
    );
    if (!order) return bad(404, "Order not found");
    if (params.action === "confirm" && order.status === "PAID")
      transition(order, "CONFIRMED");
    else if (params.action === "pack" && order.status === "CONFIRMED")
      transition(order, "PACKED");
    else if (params.action === "handover" && order.status === "PACKED") {
      transition(order, "SHIPPED");
      order.shipment = {
        carrier: "Mock carrier",
        trackingNo: `TRACK-${id().slice(0, 8)}`,
        events: [
          { status: "SHIPPED", at: now(), location: order.seller.location },
        ],
      };
    } else if (params.action === "reject" && order.status === "PAID") {
      const input = await body<{ reason: string }>(request);
      if (!input.reason?.trim()) return bad(422, "Reason required");
      transition(order, "CANCELLED", input.reason);
      for (const item of order.items) {
        const variant = getDB()
          .products.flatMap((p) => p.variants)
          .find(
            (v) =>
              v.id === (item as typeof item & { variantId: string }).variantId,
          );
        if (variant) variant.stock += item.quantity;
      }
    } else return bad(409, "Invalid order action");
    saveDB();
    return HttpResponse.json(order);
  }),
  http.get(path("/seller/settings"), ({ request }) =>
    HttpResponse.json(getDB().settings[sellerId(request)!]),
  ),
  http.put(path("/seller/settings"), async ({ request }) => {
    getDB().settings[sellerId(request)!] =
      await body<
        typeof getDB extends never
          ? never
          : import("../../features/commerce/types").SellerSettings
      >(request);
    saveDB();
    return HttpResponse.json(getDB().settings[sellerId(request)!]);
  }),
];
