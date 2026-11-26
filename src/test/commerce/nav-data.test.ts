import { beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import {
  useMarkNotificationsRead,
  useNotifications,
  useOrderSummary,
  useUnreadCount,
} from "../../features/commerce/api";
import { setSession } from "../../features/banking/client";
import { commerceHandlers } from "../../mocks/commerce";
import { getDB, resetCommerceDB } from "../../mocks/commerce/db";
import { SELLER_USER_IDS } from "../../mocks/commerce/seed";
import { server } from "../setup";

const call = (
  path: string,
  token?: string,
  method = "GET",
  payload?: unknown,
) =>
  fetch(new URL(`/api${path}`, location.origin), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
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
        seller: SELLER_USER_IDS[0],
      },
      addresses: {},
      topups: [],
    }),
  );
  resetCommerceDB();
  server.use(...commerceHandlers);
});

describe("shopper navigation data", () => {
  it("protects notifications and order summary for shopper identities", async () => {
    expect((await call("/me/notifications")).status).toBe(401);
    expect(
      (await call("/me/notifications/unread-count", "seller")).status,
    ).toBe(403);
    expect((await call("/me/orders/summary", "seller")).status).toBe(403);
  });

  it("builds notifications from shopper orders, refunds and wallet top-ups", async () => {
    const store = JSON.parse(
      localStorage.getItem("payment-banking-mock-v3")!,
    ) as { topups: unknown[] };
    store.topups.push({
      id: "topup-a-1",
      owner: "a",
      status: "COMPLETED",
      createdAt: "2026-11-23T10:00:00.000Z",
    });
    localStorage.setItem("payment-banking-mock-v3", JSON.stringify(store));

    const response = await call("/me/notifications?size=100", "a");
    expect(response.status).toBe(200);
    const page = (await response.json()) as {
      content: Record<string, unknown>[];
      totalElements: number;
      totalPages: number;
    };
    expect(page.content.length).toBe(page.totalElements);
    expect(page.totalPages).toBe(1);
    expect(page.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "PAYMENT",
          title: "Refund processed",
          href: expect.stringMatching(/^\/me\/orders\//),
          readAt: null,
        }),
        expect.objectContaining({
          kind: "WALLET",
          title: "Wallet top-up completed",
          href: "/wallet/statement",
          readAt: null,
        }),
      ]),
    );
    for (const item of page.content)
      expect(Object.keys(item).sort()).toEqual(
        ["id", "kind", "title", "body", "href", "createdAt", "readAt"].sort(),
      );

    const before = Number(
      (
        (await (await call("/me/notifications/unread-count", "a")).json()) as {
          count: number;
        }
      ).count,
    );
    const firstId = String(page.content[0].id);
    expect(
      (await call("/me/notifications/read", "a", "POST", { ids: [firstId] }))
        .status,
    ).toBe(204);
    const afterOne = (await (
      await call("/me/notifications/unread-count", "a")
    ).json()) as { count: number };
    expect(afterOne.count).toBe(before - 1);

    expect(
      (await call("/me/notifications/read", "a", "POST", { all: true })).status,
    ).toBe(204);
    expect(
      (
        (await (await call("/me/notifications/unread-count", "a")).json()) as {
          count: number;
        }
      ).count,
    ).toBe(0);
    expect(
      (
        (await (await call("/me/notifications/unread-count", "b")).json()) as {
          count: number;
        }
      ).count,
    ).toBeGreaterThan(0);
    expect(
      (await call("/me/notifications/read", "a", "POST", { all: false }))
        .status,
    ).toBe(400);
  });

  it("returns order summary counts and supports the navigation status filters", async () => {
    const shopperOrders = getDB().orders.filter(
      (order) => order.ownerId === "phone:0900000001",
    );
    const summary = (await (await call("/me/orders/summary", "a")).json()) as {
      toPay: number;
      toShip: number;
      toReceive: number;
      toConfirm: number;
    };
    expect(summary).toEqual({
      toPay: shopperOrders.filter((order) => order.status === "PENDING_PAYMENT")
        .length,
      toShip: shopperOrders.filter((order) =>
        ["PAID", "CONFIRMED", "PACKED"].includes(order.status),
      ).length,
      toReceive: shopperOrders.filter((order) => order.status === "SHIPPED")
        .length,
      toConfirm: shopperOrders.filter((order) => order.status === "DELIVERED")
        .length,
    });

    for (const [status, expected] of [
      ["TO_RECEIVE", "SHIPPED"],
      ["TO_CONFIRM", "DELIVERED"],
    ]) {
      const response = await call(`/me/orders?status=${status}&size=100`, "a");
      const result = (await response.json()) as {
        content: { status: string }[];
      };
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content.every((order) => order.status === expected)).toBe(
        true,
      );
    }
    expect((await call("/me/orders?status=UNKNOWN", "a")).status).toBe(400);
  });

  it("exposes typed list, unread, summary and mark-read hooks", async () => {
    setSession({
      accessToken: "a",
      refreshToken: "refresh",
      user: {
        id: "a",
        phone: "0900000001",
        email: "",
        fullName: "Alice",
        roles: ["SHOPPER"],
        kycTier: 0,
        status: "ACTIVE",
      },
    });
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const { result } = renderHook(
      () => ({
        notifications: useNotifications({ size: 100 }),
        unread: useUnreadCount(),
        summary: useOrderSummary(),
        markRead: useMarkNotificationsRead(),
      }),
      {
        wrapper: ({ children }) =>
          createElement(QueryClientProvider, { client }, children),
      },
    );
    await waitFor(() => {
      expect(result.current.notifications.data?.content.length).toBeGreaterThan(
        0,
      );
      expect(result.current.unread.data?.count).toBeGreaterThan(0);
      expect(result.current.summary.data?.toPay).toBeGreaterThan(0);
    });
    await result.current.markRead.mutateAsync({ all: true });
    await waitFor(() => expect(result.current.unread.data?.count).toBe(0));
  });
});
