// Provisional TASK-012 contract. Replace with generated OpenAPI when available.
import type {
  Customer,
  Order,
  OutboxEvent,
  PageResponse,
  Payment,
  PaymentHistory,
  PaymentSummary,
  Product,
  ProblemDetail,
} from "./types";
type Query = {
  page?: number;
  size?: number;
  sort?: string;
  q?: string;
  status?: string;
  customerId?: string;
  orderId?: string;
  method?: string;
  eventType?: string;
  from?: string;
  to?: string;
};
type Failure = {
  400: { content: { "application/problem+json": ProblemDetail } };
  404: { content: { "application/problem+json": ProblemDetail } };
  409: { content: { "application/problem+json": ProblemDetail } };
  500: { content: { "application/problem+json": ProblemDetail } };
};
type List<T> = {
  parameters: { query?: Query };
  responses: {
    200: { content: { "application/json": PageResponse<T> } };
  } & Failure;
};
type Get<T> = {
  parameters: { path: { id: string } };
  responses: { 200: { content: { "application/json": T } } } & Failure;
};
type Post<T, I> = {
  requestBody: { content: { "application/json": I } };
  responses: { 201: { content: { "application/json": T } } } & Failure;
};
type Put<T, I> = {
  parameters: { path: { id: string } };
  requestBody: { content: { "application/json": I } };
  responses: { 200: { content: { "application/json": T } } } & Failure;
};
type Delete = {
  parameters: { path: { id: string } };
  responses: { 204: never } & Failure;
};
type CustomerInput = Omit<Customer, "id">;
type ProductInput = Omit<Product, "id" | "active">;
type OrderInput = {
  orderCode: string;
  customerId: string;
  items: { productId: string; quantity: number }[];
};
type PaymentInput = { orderId: string; method: string };
export interface paths {
  "/customers": { get: List<Customer>; post: Post<Customer, CustomerInput> };
  "/customers/{id}": {
    get: Get<Customer>;
    put: Put<Customer, CustomerInput>;
    delete: Delete;
  };
  "/products": { get: List<Product>; post: Post<Product, ProductInput> };
  "/products/{id}": {
    get: Get<Product>;
    put: Put<Product, ProductInput>;
    delete: Delete;
  };
  "/orders": { get: List<Order>; post: Post<Order, OrderInput> };
  "/orders/{id}": {
    get: Get<Order>;
    put: Put<Order, OrderInput>;
    delete: Delete;
  };
  "/payments": { get: List<Payment>; post: Post<Payment, PaymentInput> };
  "/payments/{id}": { get: Get<Payment> };
  "/payments/{id}/status": { patch: Put<Payment, { status: string }> };
  "/payments/{id}/history": { get: Get<PaymentHistory[]> };
  "/payments/summary": {
    get: {
      parameters: { query?: Query };
      responses: {
        200: { content: { "application/json": PaymentSummary } };
      } & Failure;
    };
  };
  "/outbox-events": { get: List<OutboxEvent> };
  "/outbox-events/{id}": { get: Get<OutboxEvent> };
}
