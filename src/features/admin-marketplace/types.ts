import type {
  Category,
  Money,
  OnboardingSteps,
  OrderDetail,
  PaymentIntent,
  PaymentMethod,
  ProductDetail,
  SellerOrderDetail,
  SellerOrderStatus,
  SellerRef,
} from "../commerce/types";
import type { Address, Transaction } from "../banking/types";

export type { PageResponse } from "../commerce/types";

export interface AdminCustomerRow {
  id: string;
  fullName: string;
  phone: string;
  kycTier: number;
  status: string;
  walletBalance: Money;
  ordersCount: number;
  totalSpent: Money;
  createdAt: string;
}

export interface AdminSellerOrderRow {
  id: string;
  orderNumber: string;
  parentOrderNumber: string;
  seller: SellerRef;
  customer: { name: string; phone: string };
  status: SellerOrderStatus;
  total: Money;
  paymentMethod: PaymentMethod;
  createdAt: string;
  slaBreached: boolean;
}

export interface AdminCustomerDetail extends AdminCustomerRow {
  email: string;
  addresses: Address[];
  wallet: { available: Money; frozen: boolean };
  recentTransactions: Transaction[];
  recentOrders: AdminSellerOrderRow[];
}

export type AdminSellerStatus =
  "ONBOARDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "SUSPENDED";

export interface AdminSellerRow {
  id: string;
  slug: string;
  name: string;
  status: AdminSellerStatus;
  ownerName: string;
  location: string;
  rating: string;
  productCount: number;
  gmv30d: Money;
  commissionRatePercent: string;
  createdAt: string;
}

export interface AdminSellerDetail extends AdminSellerRow {
  statusReason?: string;
  onboarding: OnboardingSteps;
  recentOrders: AdminSellerOrderRow[];
  products: {
    live: number;
    pendingReview: number;
    rejected: number;
    hidden: number;
    outOfStock: number;
  };
}

export interface AdminCategory extends Category {
  commissionRatePercent: string;
  productCount: number;
  children: AdminCategory[];
}

export type ModerationProduct = ProductDetail & { rejectionReason?: string };

export type SagaService = "commerce" | "payment" | "bank-sim" | "carrier";

export interface SagaEvent {
  type: string;
  service: SagaService;
  at: string;
  correlationId: string;
  summary: string;
}

export interface AdminOrderDetail
  extends
    OrderDetail,
    Omit<AdminSellerOrderRow, keyof OrderDetail | "paymentMethod"> {
  paymentMethod: PaymentMethod;
  money: SellerOrderDetail["money"];
  sagaEvents: SagaEvent[];
  paymentIntent?: PaymentIntent;
}

export interface AdminAuditEntry {
  id: string;
  actor: string;
  action: string;
  subject: string;
  reason?: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}
