import { chargeWalletToEscrow } from "../banking";
export type ChargeResult = { ok: true } | { ok: false; reason: string };
export interface PaymentPort {
  available(userId: string): Promise<string>;
  charge(
    userId: string,
    amount: string,
    refs: { intentId: string; parentOrderId: string },
  ): Promise<ChargeResult>;
}
export const paymentPort: PaymentPort = {
  async available() {
    return "10000000";
  },
  async charge(userId, amount, refs) {
    return chargeWalletToEscrow(userId, amount, refs);
  },
};
