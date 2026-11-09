export type Role =
  "SHOPPER" | "SELLER_OWNER" | "SELLER_STAFF" | "ADMIN" | "FINANCE" | "SUPPORT";
export interface User {
  id: string;
  phone: string;
  email: string;
  fullName: string;
  roles: Role[];
  kycTier: number;
  status: string;
}
export interface Tokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}
export interface Address {
  id: string;
  recipient: string;
  phone: string;
  address: string;
  isDefault: boolean;
}
export interface Wallet {
  id: string;
  status: string;
  currency: "VND";
  ledgerBalance: string;
  heldAmount: string;
  availableBalance: string;
  kycTier: number;
  limits: {
    maxBalance: string;
    perTransaction: string;
    monthlyOutflow: string;
    monthlyOutflowUsed: string;
  };
}
export interface Recipient {
  userId: string;
  maskedName: string;
  maskedPhone: string;
  fullName?: string;
}
export interface Transaction {
  id: string;
  type:
    | "TOP_UP"
    | "TRANSFER_IN"
    | "TRANSFER_OUT"
    | "PAYMENT"
    | "REFUND"
    | "WITHDRAWAL";
  direction: "IN" | "OUT";
  status: "PENDING" | "COMPLETED" | "FAILED" | "EXPIRED";
  amount: string;
  balanceAfter: string;
  counterparty?: Recipient;
  reference: string;
  note: string;
  createdAt: string;
  journalId: string;
  timeline: { status: string; createdAt: string }[];
}
export interface TopUp {
  id: string;
  reference: string;
  amount: string;
  status: "PENDING" | "COMPLETED" | "FAILED" | "EXPIRED";
  qrPayload: string;
  expiresAt: string;
  createdAt?: string;
  balanceAfter?: string;
}
export interface Transfer {
  id: string;
  status: "COMPLETED" | "OTP_REQUIRED";
  otpId?: string;
  resendAvailableAt?: string;
  expiresAt?: string;
}
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  summary?: { totalIn: string; totalOut: string };
}
export interface OtpChallenge {
  otpId: string;
  resendAvailableAt: string;
  expiresAt: string;
}
