import type { Transaction } from "../../features/banking/types";
import type { Address } from "../../features/banking/types";
import type {
  AdminAuditEntry,
  AdminSellerStatus,
} from "../../features/admin-marketplace/types";

/**
 * Admin-only marketplace state that the commerce mock has no field for (commission rates,
 * suspension, rejection reasons, audit). Commerce data itself is read/written via getDB().
 */
export interface AdminState {
  sellerCommission: Record<string, string>;
  categoryCommission: Record<string, string>;
  /** Suspended sellers → product ids we hid, restored on reinstate. */
  suspended: Record<string, { reason: string; hiddenProductIds: string[] }>;
  sellerStatusReason: Record<string, string>;
  productRejections: Record<string, string>;
  adminAudit: AdminAuditEntry[];
}

const KEY = "payment-admin-marketplace-v1";
let memory: AdminState | undefined;

const empty = (): AdminState => ({
  sellerCommission: {},
  categoryCommission: {},
  suspended: {},
  sellerStatusReason: {},
  productRejections: {},
  adminAudit: [],
});

export function adminState(): AdminState {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw)
      return (memory = { ...empty(), ...(JSON.parse(raw) as AdminState) });
  } catch {
    /* fall back to empty state */
  }
  return (memory = empty());
}

export function saveAdminState() {
  try {
    localStorage.setItem(KEY, JSON.stringify(adminState()));
  } catch {
    /* in-memory only */
  }
}

export function resetAdminMarketplace() {
  memory = empty();
  saveAdminState();
}

/** Read-only view of the banking mock storage (same key the banking mock persists to). */
export interface BankingView {
  users: {
    id: string;
    phone: string;
    email?: string;
    fullName: string;
    roles: string[];
    kycTier: number;
    status: string;
  }[];
  sessions: Record<string, string>;
  addresses: Record<string, Address[]>;
  journals: { lines: { account: string; debit: string; credit: string }[] }[];
  transactions: Record<string, Transaction[]>;
  frozenWallets?: Record<string, string>;
}

export function banking(): BankingView {
  try {
    const raw = localStorage.getItem("payment-banking-mock-v3");
    if (raw) return JSON.parse(raw) as BankingView;
  } catch {
    /* no banking data */
  }
  return {
    users: [],
    sessions: {},
    addresses: {},
    journals: [],
    transactions: {},
  };
}

export type { AdminSellerStatus };
