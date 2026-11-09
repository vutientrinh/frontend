import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../banking/client";
import type {
  AdminCategory,
  AdminCustomerDetail,
  AdminCustomerRow,
  AdminOrderDetail,
  AdminSellerDetail,
  AdminSellerOrderRow,
  AdminSellerRow,
  ModerationProduct,
  PageResponse,
} from "./types";

type Params = Record<string, string | number | undefined>;

export const adminKeys = {
  all: ["admin-marketplace"] as const,
  list: (resource: string, params: Params = {}) =>
    ["admin-marketplace", resource, "list", params] as const,
  detail: (resource: string, id: string) =>
    ["admin-marketplace", resource, "detail", id] as const,
};

function query(params: Params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== "") search.set(key, String(value));
  return search.size ? `?${search}` : "";
}

const post = (body?: unknown, method = "POST"): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const useAdminCustomers = (params: Params) =>
  useQuery({
    queryKey: adminKeys.list("customers", params),
    queryFn: () =>
      request<PageResponse<AdminCustomerRow>>(
        `/admin/customers${query(params)}`,
      ),
  });

export const useAdminCustomer = (id: string) =>
  useQuery({
    queryKey: adminKeys.detail("customers", id),
    queryFn: () => request<AdminCustomerDetail>(`/admin/customers/${id}`),
    enabled: !!id,
  });

export const useAdminSellers = (params: Params) =>
  useQuery({
    queryKey: adminKeys.list("sellers", params),
    queryFn: () =>
      request<PageResponse<AdminSellerRow>>(`/admin/sellers${query(params)}`),
  });

export const useAdminSeller = (id: string) =>
  useQuery({
    queryKey: adminKeys.detail("sellers", id),
    queryFn: () => request<AdminSellerDetail>(`/admin/sellers/${id}`),
    enabled: !!id,
  });

export const useAdminCategories = () =>
  useQuery({
    queryKey: adminKeys.list("categories"),
    queryFn: () => request<AdminCategory[]>("/admin/catalog/categories"),
  });

export const useModerationQueue = (params: Params) =>
  useQuery({
    queryKey: adminKeys.list("moderation", params),
    queryFn: () =>
      request<PageResponse<ModerationProduct>>(
        `/admin/catalog/moderation${query(params)}`,
      ),
  });

export const useMarketplaceOrders = (params: Params) =>
  useQuery({
    queryKey: adminKeys.list("orders", params),
    queryFn: () =>
      request<PageResponse<AdminSellerOrderRow>>(
        `/admin/marketplace-orders${query(params)}`,
      ),
  });

export const useMarketplaceOrder = (id: string) =>
  useQuery({
    queryKey: adminKeys.detail("orders", id),
    queryFn: () => request<AdminOrderDetail>(`/admin/marketplace-orders/${id}`),
    enabled: !!id,
  });

/** Every admin mutation refreshes admin-marketplace data and the commerce caches it touches. */
function useAdminMutation<TInput, TOutput>(
  execute: (input: TInput) => Promise<TOutput>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: execute,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.all });
      void client.invalidateQueries({ queryKey: ["commerce"] });
    },
  });
}

export type SellerAction = "approve" | "reject" | "suspend" | "reinstate";

export const useSellerAction = () =>
  useAdminMutation(
    ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: SellerAction;
      reason?: string;
    }) =>
      request<AdminSellerDetail>(
        `/admin/sellers/${id}/${action}`,
        post(reason ? { reason } : undefined),
      ),
  );

export const useSellerCommission = () =>
  useAdminMutation(({ id, ratePercent }: { id: string; ratePercent: string }) =>
    request<AdminSellerDetail>(
      `/admin/sellers/${id}/commission`,
      post({ ratePercent }, "PUT"),
    ),
  );

export const useCreateCategory = () =>
  useAdminMutation(
    (input: {
      name: string;
      parentId: string | null;
      commissionRatePercent: string;
    }) => request<AdminCategory>("/admin/catalog/categories", post(input)),
  );

export const useUpdateCategory = () =>
  useAdminMutation(
    ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      commissionRatePercent?: string;
    }) =>
      request<AdminCategory>(
        `/admin/catalog/categories/${id}`,
        post(input, "PUT"),
      ),
  );

export const useModerateProduct = () =>
  useAdminMutation(
    ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: "approve" | "reject";
      reason?: string;
    }) =>
      request<ModerationProduct>(
        `/admin/catalog/products/${id}/${action}`,
        post(reason ? { reason } : undefined),
      ),
  );

export const useCancelMarketplaceOrder = () =>
  useAdminMutation(({ id, reason }: { id: string; reason: string }) =>
    request<{ ok: true }>(
      `/admin/marketplace-orders/${id}/cancel`,
      post({ reason }),
    ),
  );
