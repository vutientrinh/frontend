// Provisional TASK-002 contract. Regenerate when OpenAPI is available.
import type {
  Customer,
  Order,
  PageResponse,
  Payment,
  Product,
  ProblemDetail,
} from "./types";
type List<T> = {
  parameters: {
    query?: {
      page?: number;
      size?: number;
      sort?: string;
      status?: string;
      orderId?: string;
    };
  };
  responses: {
    200: { content: { "application/json": PageResponse<T> } };
    400: { content: { "application/problem+json": ProblemDetail } };
  };
};
export interface paths {
  "/customers": { get: List<Customer> };
  "/products": { get: List<Product> };
  "/orders": { get: List<Order> };
  "/payments": { get: List<Payment> };
}
