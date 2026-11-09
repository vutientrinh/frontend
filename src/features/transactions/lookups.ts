import { api } from "../../api/client";
import type { Customer, Order, Payment, Product } from "../../api/types";
export async function customers() {
  const result: Customer[] = [];
  let page = 0,
    total = 1;
  while (page < total) {
    const r = await api.GET("/customers", {
      params: { query: { page, size: 100 } },
    });
    if (r.error) throw r.error;
    result.push(...r.data.content);
    total = r.data.totalPages;
    page++;
  }
  return result;
}
export async function products() {
  const result: Product[] = [];
  let page = 0,
    total = 1;
  while (page < total) {
    const r = await api.GET("/products", {
      params: { query: { page, size: 100 } },
    });
    if (r.error) throw r.error;
    result.push(...r.data.content);
    total = r.data.totalPages;
    page++;
  }
  return result;
}
export async function orders(status?: string) {
  const result: Order[] = [];
  let page = 0,
    total = 1;
  while (page < total) {
    const r = await api.GET("/orders", {
      params: { query: { page, size: 100, ...(status ? { status } : {}) } },
    });
    if (r.error) throw r.error;
    result.push(...r.data.content);
    total = r.data.totalPages;
    page++;
  }
  return result;
}
export async function payments() {
  const result: Payment[] = [];
  let page = 0,
    total = 1;
  while (page < total) {
    const r = await api.GET("/payments", {
      params: { query: { page, size: 100 } },
    });
    if (r.error) throw r.error;
    result.push(...r.data.content);
    total = r.data.totalPages;
    page++;
  }
  return result;
}
