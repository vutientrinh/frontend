import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../setup";
import { commerceHandlers } from "../../mocks/commerce";
import {
  getDB,
  reloadCommerceDB,
  resetCommerceDB,
} from "../../mocks/commerce/db";
import {
  bankingHandlers,
  bankingTrialBalance,
  resetBanking,
} from "../../mocks/banking";
import { paymentPort } from "../../mocks/commerce/paymentPort";
import { SELLER_USER_IDS } from "../../mocks/commerce/seed";
const call = (
  path: string,
  token: string,
  method = "GET",
  payload?: unknown,
  key?: string,
) =>
  fetch(new URL(`/api${path}`, location.origin), {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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
          id: "shopper",
          phone: "0900000001",
          fullName: "Shopper",
          roles: ["SHOPPER"],
          status: "ACTIVE",
        },
        {
          id: SELLER_USER_IDS[0],
          phone: "seller",
          fullName: "Seller",
          roles: ["SELLER_OWNER"],
          status: "ACTIVE",
        },
      ],
      sessions: { shopper: "shopper", seller: SELLER_USER_IDS[0] },
      addresses: {},
    }),
  );
  resetCommerceDB();
  server.use(...commerceHandlers);
});
describe("payment and seller transitions", () => {
  async function authenticateSeedShopper() {
    resetBanking();
    server.use(...bankingHandlers, ...commerceHandlers);
    const response = await call("/auth/login", "", "POST", {
      login: "0900000001",
      password: "demo123",
    });
    expect(response.status).toBe(200);
    return (await response.json()) as {
      accessToken: string;
      user: { id: string };
    };
  }

  async function checkoutWallet(
    token: string,
    productIndex: number,
    key: string,
  ) {
    const product = getDB().products[productIndex];
    const variant = product.variants[0];
    const add = await call("/cart/items", token, "POST", {
      variantId: variant.id,
      quantity: 1,
    });
    expect(add.status).toBe(200);
    const cart = await (await call("/cart", token)).json();
    return call(
      "/checkout",
      token,
      "POST",
      {
        cartItemIds: [cart.groups[0].items[0].id],
        addressId: "address",
        shippingOptionIds: { [product.seller.id]: "standard" },
        paymentMethod: "WALLET",
      },
      key,
    );
  }

  it("debits a shopper wallet and credits escrow once per payment intent", async () => {
    const shopper = await authenticateSeedShopper();
    const token = shopper.accessToken;
    const before = (await (await call("/wallets/me", token)).json()) as {
      availableBalance: string;
    };
    const response = await checkoutWallet(token, 1, "wallet-checkout");
    expect(response.status).toBe(200);
    const checkout = (await response.json()) as {
      parentOrderId: string;
      paymentIntent: { id: string; amount: string; status: string };
    };
    expect(checkout.paymentIntent.status).toBe("SUCCEEDED");

    const refs = {
      intentId: checkout.paymentIntent.id,
      parentOrderId: checkout.parentOrderId,
    };
    expect(
      await paymentPort.charge(
        shopper.user.id,
        checkout.paymentIntent.amount,
        refs,
      ),
    ).toEqual({ ok: true });

    const after = (await (await call("/wallets/me", token)).json()) as {
      availableBalance: string;
    };
    expect(
      BigInt(before.availableBalance) - BigInt(after.availableBalance),
    ).toBe(BigInt(checkout.paymentIntent.amount));
    const bankDB = JSON.parse(
      localStorage.getItem("payment-banking-mock-v3")!,
    ) as {
      journals: {
        reference: string;
        lines: { account: string; debit: string; credit: string }[];
      }[];
    };
    const reference = `COMMERCE-PAYMENT:${checkout.paymentIntent.id}`;
    const journals = bankDB.journals.filter(
      (journal) => journal.reference === reference,
    );
    expect(journals).toHaveLength(1);
    expect(journals[0].lines).toEqual([
      {
        account: `2010:${shopper.user.id}`,
        debit: checkout.paymentIntent.amount,
        credit: "0",
      },
      { account: "2030", debit: "0", credit: checkout.paymentIntent.amount },
    ]);
    expect(bankingTrialBalance()).toBe("0");
  });

  it("maps insufficient wallet balance to the existing failed payment state", async () => {
    const shopper = await authenticateSeedShopper();
    const response = await checkoutWallet(
      shopper.accessToken,
      2,
      "wallet-insufficient",
    );
    const checkout = (await response.json()) as {
      paymentIntent: { id: string; status: string; failureReason?: string };
    };
    expect(checkout.paymentIntent.status).toBe("FAILED");
    expect(checkout.paymentIntent.failureReason).toMatch(/insufficient/i);
    const wallet = (await (
      await call("/wallets/me", shopper.accessToken)
    ).json()) as { availableBalance: string };
    expect(wallet.availableBalance).toBe("1000000");
  });

  it("maps wallet transaction-limit errors to failed payment state", async () => {
    const shopper = await authenticateSeedShopper();
    const financeLogin = await call("/auth/login", "", "POST", {
      login: "finance",
      password: "demo123",
    });
    const finance = (await financeLogin.json()) as { accessToken: string };
    const settings = await (
      await call("/admin/settings", finance.accessToken)
    ).json();
    expect(
      (
        await call("/admin/settings", finance.accessToken, "PUT", {
          ...settings,
          tier1PerTransaction: "500000",
        })
      ).status,
    ).toBe(200);
    const response = await checkoutWallet(
      shopper.accessToken,
      1,
      "wallet-limit",
    );
    const checkout = (await response.json()) as {
      paymentIntent: { id: string; status: string; failureReason?: string };
    };
    expect(checkout.paymentIntent.status).toBe("FAILED");
    expect(checkout.paymentIntent.failureReason).toMatch(/limit exceeded/i);
    const wallet = (await (
      await call("/wallets/me", shopper.accessToken)
    ).json()) as { availableBalance: string };
    expect(wallet.availableBalance).toBe("1000000");
  });

  it("retains orders and stock reservations when the wallet port declines", async () => {
    const product = getDB().products.find(
      (p) => p.variants[0].stock > 0 && BigInt(p.price) < 2000000n,
    )!;
    const variant = product.variants[0];
    const stock = variant.stock;
    const spy = vi
      .spyOn(paymentPort, "charge")
      .mockResolvedValue({ ok: false, reason: "Declined" });
    await call("/cart/items", "shopper", "POST", {
      variantId: variant.id,
      quantity: 1,
    });
    const cart = await (await call("/cart", "shopper")).json();
    const result = await (
      await call(
        "/checkout",
        "shopper",
        "POST",
        {
          cartItemIds: [cart.groups[0].items[0].id],
          addressId: "address",
          shippingOptionIds: { [product.seller.id]: "standard" },
          paymentMethod: "WALLET",
        },
        "decline",
      )
    ).json();
    expect(result.paymentIntent.status).toBe("FAILED");
    expect(variant.stock).toBe(stock - 1);
    expect(
      getDB().orders.find((o) => o.id === result.sellerOrders[0].id)?.status,
    ).toBe("PENDING_PAYMENT");
    spy.mockRestore();
  });
  it("replays wallet confirmation without a second charge", async () => {
    const product = getDB().products.find(
      (p) => p.variants[0].stock > 0 && BigInt(p.price) > 2000000n,
    )!;
    await call("/cart/items", "shopper", "POST", {
      variantId: product.variants[0].id,
      quantity: 1,
    });
    const cart = await (await call("/cart", "shopper")).json();
    const data = await (
      await call(
        "/checkout",
        "shopper",
        "POST",
        {
          cartItemIds: [cart.groups[0].items[0].id],
          addressId: "address",
          shippingOptionIds: { [product.seller.id]: "standard" },
          paymentMethod: "WALLET",
        },
        "checkout",
      )
    ).json();
    expect(data.paymentIntent.status).toBe("REQUIRES_ACTION");
    const spy = vi.spyOn(paymentPort, "charge").mockResolvedValue({ ok: true });
    const input = { otpId: data.paymentIntent.otpId, code: "123456" };
    const a = await (
      await call(
        `/payment-intents/${data.paymentIntent.id}/confirm`,
        "shopper",
        "POST",
        input,
        "confirm",
      )
    ).json();
    const b = await (
      await call(
        `/payment-intents/${data.paymentIntent.id}/confirm`,
        "shopper",
        "POST",
        input,
        "confirm",
      )
    ).json();
    expect(a.status).toBe("SUCCEEDED");
    expect(b.status).toBe("SUCCEEDED");
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
  it("uses timestamps to advance review and shipment", async () => {
    const product = getDB().products.find(
      (p) => p.seller.id === getDB().sellers[0].id,
    )!;
    product.status = "DRAFT";
    expect(
      (await call(`/seller/products/${product.id}/submit`, "seller", "POST"))
        .status,
    ).toBe(200);
    const order = getDB().orders.find(
      (o) => o.seller.id === getDB().sellers[0].id && o.status === "PACKED",
    )!;
    expect(
      (await call(`/seller/orders/${order.id}/handover`, "seller", "POST"))
        .status,
    ).toBe(200);
    reloadCommerceDB();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 21000);
    expect(
      (await (await call(`/seller/products/${product.id}`, "seller")).json())
        .status,
    ).toBe("LIVE");
    expect(
      (await (await call(`/seller/orders/${order.id}`, "seller")).json())
        .status,
    ).toBe("DELIVERED");
    vi.useRealTimers();
  });
});
