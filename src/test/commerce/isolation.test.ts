import { beforeEach, describe, expect, it } from "vitest";
import { server } from "../setup";
import { commerceHandlers } from "../../mocks/commerce";
import { getDB, resetCommerceDB } from "../../mocks/commerce/db";
import { SELLER_USER_IDS } from "../../mocks/commerce/seed";
const call = (
  path: string,
  token?: string,
  method = "GET",
  payload?: unknown,
  key?: string,
) =>
  fetch(new URL(`/api${path}`, location.origin), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
beforeEach(() => {
  localStorage.setItem(
    "payment-banking-mock-v3",
    JSON.stringify({
      users: [
        {
          id: "a",
          phone: "0900000001",
          fullName: "Alice",
          roles: ["SHOPPER"],
          status: "ACTIVE",
        },
        {
          id: "b",
          phone: "0900000002",
          fullName: "Bob",
          roles: ["SHOPPER"],
          status: "ACTIVE",
        },
        ...SELLER_USER_IDS.map((id, i) => ({
          id,
          phone: `seller${i}`,
          fullName: "Seller",
          roles: ["SELLER_OWNER"],
          status: "ACTIVE",
        })),
      ],
      sessions: {
        a: "a",
        b: "b",
        s: SELLER_USER_IDS[0],
        t: SELLER_USER_IDS[1],
      },
      addresses: {
        a: [
          {
            id: "address",
            recipient: "Alice",
            phone: "0900000001",
            address: "123 Example",
            isDefault: true,
          },
        ],
      },
    }),
  );
  resetCommerceDB();
  server.use(...commerceHandlers);
});
describe("commerce isolation and state", () => {
  it("requires identity and correct role; separates carts, orders and seller inventory", async () => {
    expect((await call("/cart")).status).toBe(401);
    expect((await call("/seller/products", "a")).status).toBe(403);
    const variant = getDB().products[1].variants[0];
    await call("/cart/items", "a", "POST", {
      variantId: variant.id,
      quantity: 1,
    });
    expect((await (await call("/cart", "b")).json()).groups).toHaveLength(0);
    const a = await (await call("/me/orders", "a")).json();
    const b = await (await call("/me/orders", "b")).json();
    expect(
      a.content.some(
        (o: { shippingAddress: { phone: string } }) =>
          o.shippingAddress.phone === "0900000002",
      ),
    ).toBe(false);
    expect(
      b.content.some(
        (o: { shippingAddress: { phone: string } }) =>
          o.shippingAddress.phone === "0900000001",
      ),
    ).toBe(false);
    const product = getDB().products.find(
      (p) => p.seller.id === getDB().sellers[0].id,
    )!;
    expect((await call(`/seller/products/${product.id}`, "t")).status).toBe(
      404,
    );
  });
  it("quotes port balance and snapshots selected address with replay-safe checkout", async () => {
    const variant = getDB().products[1].variants[0];
    await call("/cart/items", "a", "POST", {
      variantId: variant.id,
      quantity: 1,
    });
    const cart = await (await call("/cart", "a")).json();
    const ids = [cart.groups[0].items[0].id];
    const shippingOptionIds = { [cart.groups[0].seller.id]: "standard" };
    const quote = await (
      await call("/checkout/quote", "a", "POST", {
        cartItemIds: ids,
        addressId: "address",
      })
    ).json();
    expect(quote.walletAvailable).toBe("10000000");
    const input = {
      cartItemIds: ids,
      addressId: "address",
      shippingOptionIds,
      paymentMethod: "VIETQR",
    };
    const one = await (
      await call("/checkout", "a", "POST", input, "key")
    ).json();
    const two = await (
      await call("/checkout", "a", "POST", input, "key")
    ).json();
    expect(two.parentOrderId).toBe(one.parentOrderId);
    expect(
      (await (await call(`/me/orders/${one.sellerOrders[0].id}`, "a")).json())
        .shippingAddress.address,
    ).toBe("123 Example");
    expect(
      (await call(`/me/orders/${one.sellerOrders[0].id}`, "b")).status,
    ).toBe(404);
  });
  it("computes dashboard from seller orders", async () => {
    const dashboard = await (await call("/seller/dashboard", "s")).json();
    const seller = getDB().sellers[0];
    const eligible = getDB().orders.filter(
      (o) =>
        o.seller.id === seller.id &&
        !["PENDING_PAYMENT", "CANCELLED"].includes(o.status),
    );
    expect(dashboard.revenueToday.gross).not.toBe("0");
    expect(eligible.length).toBeGreaterThan(0);
  });
  it("maps each shopper tab to the contract statuses", async () => {
    const tabs: Record<string, string[]> = {
      TO_PAY: ["PENDING_PAYMENT"],
      TO_SHIP: ["PAID", "CONFIRMED", "PACKED"],
      SHIPPING: ["SHIPPED"],
      DELIVERED: ["DELIVERED", "COMPLETED"],
      RETURNS: ["RETURN_REQUESTED", "RETURNED", "REFUNDED"],
      CANCELLED: ["CANCELLED"],
    };
    for (const [tab, expected] of Object.entries(tabs)) {
      const result = await (await call(`/me/orders?tab=${tab}`, "a")).json();
      expect(
        result.content.map((order: { status: string }) => order.status).sort(),
      ).toEqual([...expected].sort());
    }
  });
  it("separates seller settings and returns field errors for invalid stock", async () => {
    const a = await (await call("/seller/settings", "s")).json();
    const b = await (await call("/seller/settings", "t")).json();
    expect(a.shopName).not.toBe(b.shopName);
    const variant = getDB().products[1].variants[0];
    const response = await call("/cart/items", "a", "POST", {
      variantId: variant.id,
      quantity: variant.stock + 1,
    });
    expect(response.status).toBe(422);
    expect((await response.json()).fieldErrors.length).toBeGreaterThan(0);
  });
  it("distinguishes availability from maximum quantity", async () => {
    const product = getDB().products[1];
    const variant = product.variants[0];
    await call("/cart/items", "a", "POST", {
      variantId: variant.id,
      quantity: 2,
    });
    variant.stock = 1;
    let item = (await (await call("/cart", "a")).json()).groups[0].items[0];
    expect(item.available).toBe(true);
    expect(item.maxQuantity).toBe(1);
    product.status = "HIDDEN";
    item = (await (await call("/cart", "a")).json()).groups[0].items[0];
    expect(item.available).toBe(false);
    expect(item.maxQuantity).toBe(1);
  });
  it("rejects a bank holder that does not match the onboarding owner", async () => {
    const id = SELLER_USER_IDS[3];
    const raw = JSON.parse(localStorage.getItem("payment-banking-mock-v3")!);
    raw.sessions.newSeller = id;
    localStorage.setItem("payment-banking-mock-v3", JSON.stringify(raw));
    const owner = {
      fullName: "Nguyễn Văn An",
      dateOfBirth: "1990-01-01",
      idNumber: "123",
      idFrontImage: "front",
      idBackImage: "back",
    };
    expect(
      (await call("/seller/onboarding/owner", "newSeller", "PUT", owner))
        .status,
    ).toBe(200);
    const mismatch = await call("/seller/onboarding/bank", "newSeller", "PUT", {
      bankName: "Bank",
      accountNumber: "123",
      accountHolder: "Different Owner",
    });
    expect(mismatch.status).toBe(422);
    expect((await mismatch.json()).fieldErrors.length).toBeGreaterThan(0);
    expect(
      (
        await call("/seller/onboarding/bank", "newSeller", "PUT", {
          bankName: "Bank",
          accountNumber: "123",
          accountHolder: "NGUYEN VAN AN",
        })
      ).status,
    ).toBe(200);
  });
});
