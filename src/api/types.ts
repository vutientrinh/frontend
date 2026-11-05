// Provisional TASK-002 contract; replace with generated types when available.
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  fieldErrors?: { field: string; message: string }[];
}
export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
}
export interface Product {
  id: string;
  productName: string;
  productDescription: string;
  unitPrice: string;
  active?: boolean;
}
export interface Order {
  id: string;
  orderCode: string;
  status: string;
  orderAmount: string;
  customerId: string;
  items: { productId: string; quantity: number; price: string }[];
  createdAt: string;
  customerName: string;
}
export interface PaymentHistory { status: string; changedAt: string; source: 'SYSTEM' | 'MANUAL'; note?: string }
export interface OutboxEvent { id: string; eventType: string; aggregateType: string; aggregateId: string; status: 'PENDING' | 'PUBLISHED' | 'FAILED'; attempts: number; nextRetryAt: string | null; lastError: string | null; createdAt: string; publishedAt: string | null }
export interface PaymentSummary { currency: string; totalAmount: string; totalCount: number; byStatus: { status: string; count: number; amount: string }[]; daily: { date: string; count: number; amount: string }[] }
export interface Payment {
  id: string;
  orderId: string;
  status: string;
  method: string;
  amount: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}
