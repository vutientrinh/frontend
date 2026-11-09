import { beforeEach, describe, expect, it } from "vitest";
import { server } from "./setup";
import {
  bankingHandlers,
  bankingTrialBalance,
  setBankingTierForTest,
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
async function get(path: string, token: string) {
  return fetch(url(path), { headers: { Authorization: `Bearer ${token}` } });
}
async function login(phone: string) {
  const r = await post("/auth/login", { login: phone, password: "demo123" });
  expect(r.status).toBe(200);
  return ((await r.json()) as { accessToken: string }).accessToken;
}
beforeEach(() => {
  localStorage.clear();
  resetBanking();
  server.use(...bankingHandlers);
});
describe("banking mock", () => {
  it("posts one balanced transfer and preserves each running balance on retries", async () => {
    const a = await login("0900000001"),
      b = await login("0900000002"),
      lookup = await get("/wallets/recipients/lookup?q=0900000002", a),
      recipient = (await lookup.json()) as { userId: string };
    const input = {
        recipientUserId: recipient.userId,
        amount: "250000",
        note: "Lunch",
      },
      first = await post("/wallets/me/transfers", input, a, "transfer-key"),
      result = (await first.json()) as { id: string };
    expect(first.status).toBe(200);
    const retry = await post("/wallets/me/transfers", input, a, "transfer-key");
    expect(await retry.json()).toEqual(result);
    const conflict = await post(
      "/wallets/me/transfers",
      { ...input, amount: "1" },
      a,
      "transfer-key",
    );
    expect(conflict.status).toBe(409);
    const wa = (await (await get("/wallets/me", a)).json()) as {
        availableBalance: string;
      },
      wb = (await (await get("/wallets/me", b)).json()) as {
        availableBalance: string;
      };
    expect(wa.availableBalance).toBe("750000");
    expect(wb.availableBalance).toBe("1250000");
    const statement = (await (
      await get("/wallets/me/transactions", a)
    ).json()) as {
      content: { balanceAfter: string; amount: string }[];
      summary: { totalIn: string; totalOut: string };
    };
    expect(statement.content[0]).toMatchObject({
      balanceAfter: "750000",
      amount: "250000",
    });
    expect(statement.content[1].balanceAfter).toBe("1000000");
    expect(statement.summary).toEqual({
      totalIn: "1000000",
      totalOut: "250000",
    });
  });
  it("rejects insufficient funds, invalid values and self transfers", async () => {
    const a = await login("0900000001"),
      other = (await (
        await get("/wallets/recipients/lookup?q=0900000002", a)
      ).json()) as { userId: string },
      self = (await (
        await get("/wallets/recipients/lookup?q=0900000001", a)
      ).json()) as { userId: string };
    for (const [recipientUserId, amount] of [
      [other.userId, "1000001"],
      [other.userId, "1.5"],
      [self.userId, "1"],
    ]) {
      const r = await post(
        "/wallets/me/transfers",
        { recipientUserId, amount, note: "" },
        a,
        crypto.randomUUID(),
      );
      expect(r.status).toBe(422);
    }
  });
  it("creates a pending top-up idempotently and requires confirmation before credit", async () => {
    const a = await login("0900000001"),
      body = { amount: "100000", method: "VIETQR" };
    const first = await post("/wallets/me/top-ups", body, a, "topup-key"),
      data = (await first.json()) as { id: string; status: string };
    expect(data.status).toBe("PENDING");
    expect(
      await (await post("/wallets/me/top-ups", body, a, "topup-key")).json(),
    ).toEqual(data);
    expect(
      (
        (await (await get("/wallets/me", a)).json()) as {
          availableBalance: string;
        }
      ).availableBalance,
    ).toBe("1000000");
  });
  it("credits a bank-confirmed top-up once despite duplicate callbacks", async () => {
    const token = await login("0900000001");
    const top = (await (
      await post(
        "/wallets/me/top-ups",
        { amount: "100000", method: "VIETQR" },
        token,
        "new-topup",
      )
    ).json()) as { id: string; reference: string };
    const accounts = (await (
      await fetch(url("/bank-sim/accounts"))
    ).json()) as { id: string }[];
    const config = await fetch(url("/bank-sim/failure-config"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        delayMs: 0,
        declineRate: 0,
        duplicateCallback: true,
      }),
    });
    expect(config.status).toBe(200);
    const transfer = await post(
      "/bank-sim/transfers",
      {
        fromAccountId: accounts[0].id,
        toReference: top.reference,
        amount: "120000",
      },
      undefined,
      "bank-transfer",
    );
    expect(transfer.status).toBe(200);
    expect(
      (
        (await (await get(`/top-ups/${top.id}`, token)).json()) as {
          status: string;
        }
      ).status,
    ).toBe("COMPLETED");
    expect(
      (
        (await (await get("/wallets/me", token)).json()) as {
          availableBalance: string;
        }
      ).availableBalance,
    ).toBe("1120000");
    expect(
      (
        (await (await get("/wallets/me/transactions", token)).json()) as {
          content: unknown[];
        }
      ).content,
    ).toHaveLength(2);
    expect(bankingTrialBalance()).toBe("0");
  });
  it("requires OTP above the threshold and commits a confirmed transfer once", async () => {
    const token = await login("0900000001");
    const me = (await (await get("/me", token)).json()) as { id: string };
    setBankingTierForTest(me.id, 2);
    const top = (await (
      await post(
        "/wallets/me/top-ups",
        { amount: "3000000", method: "VIETQR" },
        token,
        "otp-topup",
      )
    ).json()) as { id: string; reference: string };
    const accounts = (await (
      await fetch(url("/bank-sim/accounts"))
    ).json()) as { id: string }[];
    expect(
      (
        await post(
          "/bank-sim/transfers",
          {
            fromAccountId: accounts[0].id,
            toReference: top.reference,
            amount: "3000000",
          },
          undefined,
          "otp-bank",
        )
      ).status,
    ).toBe(200);
    await get(`/top-ups/${top.id}`, token);
    const recipient = (await (
      await get("/wallets/recipients/lookup?q=0900000002", token)
    ).json()) as { userId: string };
    const transfer = (await (
      await post(
        "/wallets/me/transfers",
        { recipientUserId: recipient.userId, amount: "2100000", note: "" },
        token,
        "otp-transfer",
      )
    ).json()) as { id: string; status: string; otpId: string };
    expect(transfer.status).toBe("OTP_REQUIRED");
    expect(
      (
        await post(
          `/transfers/${transfer.id}/confirm`,
          { otpId: transfer.otpId, code: "000000" },
          token,
          "otp-confirm",
        )
      ).status,
    ).toBe(422);
    const confirm = await post(
      `/transfers/${transfer.id}/confirm`,
      { otpId: transfer.otpId, code: "123456" },
      token,
      "otp-confirm",
    );
    expect(confirm.status).toBe(200);
    const result = await confirm.json();
    expect(
      await (
        await post(
          `/transfers/${transfer.id}/confirm`,
          { otpId: transfer.otpId, code: "123456" },
          token,
          "otp-confirm",
        )
      ).json(),
    ).toEqual(result);
    expect(
      (
        (await (await get("/wallets/me", token)).json()) as {
          availableBalance: string;
        }
      ).availableBalance,
    ).toBe("1900000");
    expect(bankingTrialBalance()).toBe("0");
  });
  it("registers, verifies and opens a tier-one wallet", async () => {
    const registration = await post("/auth/register", {
      phone: "0901234567",
      password: "secret12",
    });
    expect(registration.status).toBe(200);
    const challenge = (await registration.json()) as {
      otpId: string;
      expiresAt: string;
      resendAvailableAt: string;
    };
    const { otpId } = challenge;
    expect(Date.parse(challenge.expiresAt)).toBeGreaterThan(Date.now());
    expect(Date.parse(challenge.resendAvailableAt)).toBeGreaterThan(Date.now());
    expect(
      (await post("/auth/otp/verify", { otpId, code: "000000" })).status,
    ).toBe(422);
    const verified = (await (
      await post("/auth/otp/verify", { otpId, code: "123456" })
    ).json()) as { accessToken: string };
    const token = verified.accessToken;
    expect((await get("/wallets/me", token)).status).toBe(404);
    expect(
      (
        await post(
          "/me/kyc/tier1",
          {
            fullName: "Test User",
            dateOfBirth: "1990-01-01",
            idNumber: "123456789",
          },
          token,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        (await (await get("/wallets/me", token)).json()) as {
          availableBalance: string;
        }
      ).availableBalance,
    ).toBe("0");
  });
  it("reports a tier-one transaction limit after funds are available", async () => {
    const token = await login("0900000001");
    const top = (await (
      await post(
        "/wallets/me/top-ups",
        { amount: "3000000", method: "VIETQR" },
        token,
        "limit-topup",
      )
    ).json()) as { id: string; reference: string };
    const accounts = (await (
      await fetch(url("/bank-sim/accounts"))
    ).json()) as { id: string }[];
    await post(
      "/bank-sim/transfers",
      {
        fromAccountId: accounts[0].id,
        toReference: top.reference,
        amount: "3000000",
      },
      undefined,
      "limit-bank",
    );
    await get(`/top-ups/${top.id}`, token);
    const recipient = (await (
      await get("/wallets/recipients/lookup?q=0900000002", token)
    ).json()) as { userId: string };
    const rejected = await post(
      "/wallets/me/transfers",
      { recipientUserId: recipient.userId, amount: "2000001", note: "" },
      token,
      "limit-transfer",
    );
    expect(rejected.status).toBe(422);
    expect(((await rejected.json()) as { detail: string }).detail).toMatch(
      /per-transaction limit/i,
    );
    expect(bankingTrialBalance()).toBe("0");
  });
});
