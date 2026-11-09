import { beforeEach, describe, expect, it } from "vitest";
import { server } from "./setup";
import {
  bankingHandlers,
  bankingTrialBalance,
  chargeWalletToEscrow,
  resetBanking,
} from "../mocks/banking";
const url = (path: string) => new URL(`/api${path}`, window.location.origin);
async function post(path: string, body: unknown, token?: string, key?: string) {
  return fetch(url(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function get(path: string, token?: string) {
  return fetch(url(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}
async function login(loginId: string) {
  const response = await post("/auth/login", {
    login: loginId,
    password: "demo123",
  });
  return ((await response.json()) as { accessToken: string }).accessToken;
}
beforeEach(() => {
  localStorage.clear();
  resetBanking();
  server.use(...bankingHandlers);
});
describe("bank simulator and admin banking contract", () => {
  it("charges a wallet into escrow once and rejects an insufficient charge", () => {
    const db = JSON.parse(localStorage.getItem("payment-banking-mock-v3")!) as {
      users: { id: string; phone: string }[];
      journals: {
        reference: string;
        lines: { account: string; debit: string; credit: string }[];
      }[];
    };
    const owner = db.users.find((user) => user.phone === "0900000001")!;
    const refs = { intentId: "intent-once", parentOrderId: "order-1" };

    expect(chargeWalletToEscrow(owner.id, "500000", refs)).toEqual({
      ok: true,
    });
    expect(chargeWalletToEscrow(owner.id, "500000", refs)).toEqual({
      ok: true,
    });
    expect(
      chargeWalletToEscrow(owner.id, "600000", {
        ...refs,
        intentId: "intent-short",
      }),
    ).toEqual({
      ok: false,
      reason: "Insufficient available balance.",
    });

    const saved = JSON.parse(
      localStorage.getItem("payment-banking-mock-v3")!,
    ) as typeof db;
    const journal = saved.journals.find(
      (entry) => entry.reference === "COMMERCE-PAYMENT:intent-once",
    )!;
    expect(journal.lines).toEqual([
      { account: `2010:${owner.id}`, debit: "500000", credit: "0" },
      { account: "2030", debit: "0", credit: "500000" },
    ]);
    expect(
      saved.journals.filter((entry) => entry.reference === journal.reference),
    ).toHaveLength(1);
    expect(bankingTrialBalance()).toBe("0");
  });

  it("deposits cash idempotently and routes unknown references to suspense", async () => {
    const shopperToken = await login("0900000001");
    const accounts = (await (await get("/bank-sim/accounts")).json()) as {
      id: string;
    }[];
    const accountId = accounts[0].id;
    const deposit = await post(
      `/bank-sim/accounts/${accountId}/deposit`,
      { amount: "500000" },
      shopperToken,
      "deposit-once",
    );
    expect(deposit.status).toBe(200);
    const deposited = await deposit.json();
    expect(
      await (
        await post(
          `/bank-sim/accounts/${accountId}/deposit`,
          { amount: "500000" },
          shopperToken,
          "deposit-once",
        )
      ).json(),
    ).toEqual(deposited);
    const body = {
      fromAccountId: accountId,
      toReference: "UNKNOWN-REF",
      amount: "100000",
    };
    const transfer = await post(
      "/bank-sim/transfers",
      body,
      shopperToken,
      "unknown-ref-transfer",
    );
    expect(transfer.status).toBe(200);
    const result = (await transfer.json()) as { id: string };
    expect(
      await (
        await post(
          "/bank-sim/transfers",
          body,
          shopperToken,
          "unknown-ref-transfer",
        )
      ).json(),
    ).toEqual(result);
    const admin = await login("admin");
    const operations = (await (
      await get("/admin/wallet-operations?type=SUSPENSE", admin)
    ).json()) as { bankRef: string; amount: string }[];
    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      bankRef: result.id,
      amount: "100000",
    });
    expect(bankingTrialBalance()).toBe("0");
  });
  it("freezes and unfreezes a wallet with audit evidence and rejects non-staff writes", async () => {
    const admin = await login("admin");
    const wallets = (await (await get("/admin/wallets", admin)).json()) as {
      id: string;
      status: string;
    }[];
    expect(wallets).toHaveLength(3);
    const target = wallets[0].id;
    const shopper = await login("0900000001");
    expect((await get("/admin/wallets", shopper)).status).toBe(401);
    expect(
      (
        await post(
          `/admin/wallets/${target}/freeze`,
          { reason: "Risk review" },
          shopper,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await post(
          `/admin/wallets/${target}/freeze`,
          { reason: "Risk review" },
          admin,
        )
      ).status,
    ).toBe(200);
    expect(
      ((await (await get("/wallets/me", shopper)).json()) as { status: string })
        .status,
    ).toBe("FROZEN");
    expect(
      (
        await post(
          `/admin/wallets/${target}/unfreeze`,
          { reason: "Review complete" },
          admin,
        )
      ).status,
    ).toBe(200);
    const audit = (await (
      await get("/admin/audit-logs?action=WALLET_", admin)
    ).json()) as { action: string }[];
    expect(audit.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(["WALLET_FROZEN", "WALLET_UNFROZEN"]),
    );
  });
  it("updates operational limits and records before/after values", async () => {
    const admin = await login("admin");
    const original = await (await get("/admin/settings", admin)).json();
    const updated = {
      ...(original as object),
      otpThreshold: "1500000",
      topUpTtlMinutes: 20,
    };
    expect(
      (
        await fetch(url("/admin/settings"), {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${admin}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updated),
        })
      ).status,
    ).toBe(200);
    expect(await (await get("/admin/settings", admin)).json()).toMatchObject({
      otpThreshold: "1500000",
      topUpTtlMinutes: 20,
    });
    const audit = (await (
      await get("/admin/audit-logs?action=BANKING_SETTINGS_UPDATED", admin)
    ).json()) as {
      before: { otpThreshold: string };
      after: { otpThreshold: string };
    }[];
    expect(audit[0]).toMatchObject({
      before: { otpThreshold: "2000000" },
      after: { otpThreshold: "1500000" },
    });
  });
});
