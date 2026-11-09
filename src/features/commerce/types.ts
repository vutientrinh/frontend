export type Money = string;
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export interface SellerRef {
  id: string;
  slug: string;
  name: string;
  location: string;
  rating: string;
}
export interface Category {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  iconName: string;
  attributes?: string[];
}
export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  price: Money;
  compareAtPrice?: Money;
  rating: string;
  ratingCount: number;
  soldCount: number;
  variantCount?: number;
  seller: SellerRef;
  inStock: boolean;
}
export interface Variant {
  id: string;
  sku: string;
  options: Record<string, string>;
  price: Money;
  compareAtPrice?: Money;
  stock: number;
  weightGrams: number;
}
export interface ProductSpec {
  label: string;
  value: string;
}
export interface ProductReview {
  id: string;
  displayName: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
  verifiedPurchase: boolean;
}
export type RatingBreakdown = Record<1 | 2 | 3 | 4 | 5, number>;
export interface ProductShippingEstimate {
  destination: string;
  minDays: number;
  maxDays: number;
  fee: Money;
}
export type ProductStatus =
  "DRAFT" | "PENDING_REVIEW" | "LIVE" | "REJECTED" | "HIDDEN";
export interface ProductDetail extends ProductSummary {
  description: string;
  images: string[];
  attributes: { name: string; value: string }[];
  options: { name: string; values: string[] }[];
  variants: Variant[];
  category: { slug: string; name: string };
  status: ProductStatus;
  specs?: ProductSpec[];
  reviews?: ProductReview[];
  ratingBreakdown?: RatingBreakdown;
  shippingEstimate?: ProductShippingEstimate;
  shippingDimensions?: { lengthCm: number; widthCm: number; heightCm: number };
}
export type SellerOrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "CONFIRMED"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "RETURN_REQUESTED"
  | "RETURNED"
  | "REFUNDED"
  | "DELIVERY_FAILED";
export type PaymentIntentStatus =
  | "CREATED"
  | "PROCESSING"
  | "REQUIRES_ACTION"
  | "SUCCEEDED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED";
export type PaymentMethod = "WALLET" | "VIETQR";
export interface PaymentIntent {
  id: string;
  parentOrderId: string;
  orderNumber: string;
  method: PaymentMethod;
  status: PaymentIntentStatus;
  amount: Money;
  expiresAt: string;
  reference?: string;
  qrPayload?: string;
  otpRequired?: boolean;
  otpId?: string;
  failureReason?: string;
}
export interface SellerProfile extends SellerRef {
  description: string;
  logoUrl: string;
  bannerUrl: string;
  productCount: number;
  joinedAt: string;
  responseRate: string;
}
export interface CatalogHome {
  banners: {
    id: string;
    title: string;
    subtitle: string;
    href: string;
    imageUrl: string;
  }[];
  deals: ProductSummary[];
  recommended: ProductSummary[];
  categories: Category[];
}
export interface CartItem {
  id: string;
  variantId: string;
  productSlug: string;
  name: string;
  variantLabel: string;
  imageUrl: string;
  unitPrice: Money;
  quantity: number;
  stock: number;
  maxQuantity: number;
  selected: boolean;
  available: boolean;
  priceChangedFrom?: Money;
}
export interface Cart {
  groups: { seller: SellerRef; items: CartItem[] }[];
  selectedCount: number;
  selectedSubtotal: Money;
}
export interface ShippingOption {
  id: string;
  name: string;
  fee: Money;
  etaDays: number;
}
export interface CheckoutQuote {
  groups: {
    seller: SellerRef;
    items: CartItem[];
    subtotal: Money;
    shippingOptions: ShippingOption[];
    selectedShippingOptionId: string;
    shippingFee: Money;
  }[];
  itemsTotal: Money;
  shippingTotal: Money;
  discount: Money;
  total: Money;
  walletAvailable: Money;
  warnings: string[];
}
export interface CheckoutRequest {
  cartItemIds: string[];
  addressId: string;
  shippingOptionIds: Record<string, string>;
  paymentMethod: PaymentMethod;
  notes?: Record<string, string>;
}
export interface CheckoutResult {
  parentOrderId: string;
  orderNumber: string;
  sellerOrders: {
    id: string;
    orderNumber: string;
    seller: SellerRef;
    total: Money;
  }[];
  paymentIntent: PaymentIntent;
}
export type ShopperOrderTab =
  "TO_PAY" | "TO_SHIP" | "SHIPPING" | "DELIVERED" | "RETURNS" | "CANCELLED";
export type OrderAction =
  "PAY" | "CANCEL" | "CONFIRM_RECEIVED" | "RETURN" | "TRACK";
export interface OrderItemPreview {
  name: string;
  imageUrl: string;
  variantLabel: string;
  quantity: number;
}
export interface ShopperOrder {
  id: string;
  orderNumber: string;
  parentOrderId: string;
  paymentIntentId: string;
  seller: SellerRef;
  status: SellerOrderStatus;
  itemsPreview: OrderItemPreview[];
  itemCount: number;
  total: Money;
  createdAt: string;
  actions: OrderAction[];
}
export interface OrderDetail extends ShopperOrder {
  items: (OrderItemPreview & {
    variantId?: string;
    unitPrice: Money;
    lineTotal: Money;
  })[];
  shippingAddress: { recipient: string; phone: string; address: string };
  shippingFee: Money;
  discount: Money;
  payment: {
    intentId: string;
    method: PaymentMethod;
    status: PaymentIntentStatus;
    paidAt?: string;
  };
  timeline: { status: SellerOrderStatus; at: string; note?: string }[];
  shipment?: {
    carrier: string;
    trackingNo: string;
    events: { status: string; at: string; location: string }[];
  };
}
export type OnboardingStep = "shop" | "owner" | "documents" | "bank" | "terms";
export type OnboardingStatus =
  "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
export interface Onboarding {
  status: OnboardingStatus;
  currentStep: OnboardingStep;
  steps: OnboardingSteps;
  rejectionReason?: string;
}
export interface SellerDashboard {
  toConfirm: number;
  toPack: number;
  readyToShip: number;
  revenueToday: { gross: Money; net: Money };
  revenue30d: { gross: Money; net: Money };
  pendingEscrow: Money;
  walletBalance: Money;
  lowStockCount: number;
  cancelRate: string;
  lateShipRate: string;
  confirmDeadlines: { orderId: string; orderNumber: string; dueAt: string }[];
}
export type SellerProduct = ProductSummary & {
  status: ProductStatus;
  variantCount: number;
  totalStock: number;
};
export interface InventoryRow {
  variantId: string;
  sku: string;
  productName: string;
  variantLabel: string;
  onHand: number;
  reserved: number;
  available: number;
}
export type SellerOrderTab =
  | "TO_CONFIRM"
  | "TO_PACK"
  | "READY_TO_SHIP"
  | "SHIPPING"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNS";
export interface OnboardingSteps {
  shop?: {
    shopName: string;
    slug: string;
    description: string;
    location: string;
    contactPhone: string;
    contactEmail: string;
  };
  owner?: {
    fullName: string;
    dateOfBirth: string;
    idNumber: string;
    idFrontImage: string;
    idBackImage: string;
  };
  documents?: {
    businessType: "INDIVIDUAL" | "HOUSEHOLD" | "COMPANY";
    businessRegistrationNo?: string;
    taxCode?: string;
    documentNames: string[];
  };
  bank?: { bankName: string; accountNumber: string; accountHolder: string };
  terms?: { acceptedCommissionPlan: "STANDARD_5"; acceptedAt: string };
}
export interface SellerSettings {
  shopName: string;
  description: string;
  location: string;
  contactPhone: string;
  contactEmail: string;
  logoUrl?: string;
  bannerUrl?: string;
  notifications: { newOrder: boolean; lowStock: boolean; payout: boolean };
}
export interface ProductWrite {
  name: string;
  categorySlug: string;
  description: string;
  images: string[];
  attributes: ProductDetail["attributes"];
  options: ProductDetail["options"];
  variants: (Omit<Variant, "id"> & { id?: string })[];
  shippingDimensions?: { lengthCm: number; widthCm: number; heightCm: number };
}
export interface InventoryMovement {
  id: string;
  delta: number;
  reason: string;
  at: string;
}
export interface SellerOrderDetail extends OrderDetail {
  buyer: { maskedName: string; maskedPhone: string };
  money: {
    gross: Money;
    commission: Money;
    vatOnCommission: Money;
    net: Money;
    escrowStatus: string;
  };
}
