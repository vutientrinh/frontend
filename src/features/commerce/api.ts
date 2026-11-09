import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../banking/client";
import type {
  Cart,
  CatalogHome,
  Category,
  CheckoutQuote,
  CheckoutRequest,
  CheckoutResult,
  InventoryMovement,
  InventoryRow,
  Onboarding,
  OnboardingStep,
  OnboardingSteps,
  OrderDetail,
  PageResponse,
  PaymentIntent,
  ProductDetail,
  ProductSummary,
  ProductWrite,
  SellerDashboard,
  SellerOrderDetail,
  SellerProduct,
  SellerProfile,
  SellerSettings,
  ShopperOrder,
} from "./types";
export const commerceKeys = {
  all: ["commerce"] as const,
  catalog: (params: Record<string, string | number | undefined> = {}) =>
    ["commerce", "catalog", params] as const,
  cart: ["commerce", "cart"] as const,
  payment: (id: string) => ["commerce", "payment", id] as const,
  orders: (params: Record<string, string | number | undefined> = {}) =>
    ["commerce", "orders", params] as const,
  seller: (
    resource: string,
    params: Record<string, string | number | undefined> = {},
  ) => ["commerce", "seller", resource, params] as const,
};
type Params = Record<string, string | number | boolean | undefined>;
function query(params: Params = {}) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") p.set(key, String(value));
  });
  return p.size ? `?${p}` : "";
}
function json(method: string, value?: unknown, key?: string): RequestInit {
  return {
    method,
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
    ...(key ? { headers: { "Idempotency-Key": key } } : {}),
  };
}
function useCommerceMutation<TInput, TOutput>(
  execute: (input: TInput) => Promise<TOutput>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: execute,
    onSuccess: () => client.invalidateQueries({ queryKey: commerceKeys.all }),
  });
}
export const useCategories = () =>
  useQuery({
    queryKey: ["commerce", "categories"],
    queryFn: () => request<Category[]>("/catalog/categories"),
  });
export const useCatalogHome = () =>
  useQuery({
    queryKey: ["commerce", "home"],
    queryFn: () => request<CatalogHome>("/catalog/home"),
  });
export const useCatalogProducts = (params: Params = {}) =>
  useQuery({
    queryKey: ["commerce", "catalog", params],
    queryFn: () =>
      request<PageResponse<ProductSummary>>(
        `/catalog/products${query(params)}`,
      ),
  });
export const useProduct = (slug: string) =>
  useQuery({
    queryKey: ["commerce", "product", slug],
    queryFn: () =>
      request<ProductDetail>(`/catalog/products/${encodeURIComponent(slug)}`),
    enabled: !!slug,
  });
// Product detail facts share the same cached request; these selectors keep
// consumers focused without adding endpoints or duplicate network requests.
export const useProductSpecs = (slug: string) => {
  const product = useProduct(slug);
  return { ...product, data: product.data?.specs };
};
export const useProductReviews = (slug: string) => {
  const product = useProduct(slug);
  return { ...product, data: product.data?.reviews };
};
export const useProductRatingBreakdown = (slug: string) => {
  const product = useProduct(slug);
  return { ...product, data: product.data?.ratingBreakdown };
};
export const useProductShippingEstimate = (slug: string) => {
  const product = useProduct(slug);
  return { ...product, data: product.data?.shippingEstimate };
};
export const useSellerProfile = (slug: string) =>
  useQuery({
    queryKey: ["commerce", "shop", slug],
    queryFn: () =>
      request<SellerProfile>(`/catalog/sellers/${encodeURIComponent(slug)}`),
    enabled: !!slug,
  });
export const useCart = () =>
  useQuery({
    queryKey: commerceKeys.cart,
    queryFn: () => request<Cart>("/cart"),
  });
export const useAddCartItem = () =>
  useCommerceMutation((input: { variantId: string; quantity: number }) =>
    request<Cart>("/cart/items", json("POST", input)),
  );
export const useUpdateCartItem = () =>
  useCommerceMutation(
    ({ id, ...input }: { id: string; quantity?: number; selected?: boolean }) =>
      request<Cart>(`/cart/items/${id}`, json("PATCH", input)),
  );
export const useDeleteCartItem = () =>
  useCommerceMutation((id: string) =>
    request<Cart>(`/cart/items/${id}`, json("DELETE")),
  );
export const useCheckoutQuote = () =>
  useCommerceMutation(
    (input: {
      cartItemIds: string[];
      addressId: string;
      shippingOptionIds?: Record<string, string>;
      voucherCode?: string;
    }) => request<CheckoutQuote>("/checkout/quote", json("POST", input)),
  );
export const useCheckout = () =>
  useCommerceMutation(
    ({
      idempotencyKey,
      ...input
    }: CheckoutRequest & { idempotencyKey: string }) =>
      request<CheckoutResult>("/checkout", json("POST", input, idempotencyKey)),
  );
export const usePaymentIntent = (id: string) =>
  useQuery({
    queryKey: commerceKeys.payment(id),
    queryFn: () => request<PaymentIntent>(`/payment-intents/${id}`),
    enabled: !!id,
    refetchInterval: (q) =>
      q.state.data &&
      ["CREATED", "PROCESSING", "REQUIRES_ACTION"].includes(q.state.data.status)
        ? 3000
        : false,
  });
export const useConfirmPayment = () =>
  useCommerceMutation(
    ({
      id,
      ...input
    }: {
      id: string;
      otpId: string;
      code: string;
      idempotencyKey: string;
    }) =>
      request<PaymentIntent>(
        `/payment-intents/${id}/confirm`,
        json(
          "POST",
          { otpId: input.otpId, code: input.code },
          input.idempotencyKey,
        ),
      ),
  );
export const useCancelPayment = () =>
  useCommerceMutation((id: string) =>
    request<PaymentIntent>(`/payment-intents/${id}/cancel`, json("POST")),
  );
export const useSimulatePayment = () =>
  useCommerceMutation(
    ({ id, outcome }: { id: string; outcome: "SUCCEEDED" | "FAILED" }) =>
      request<PaymentIntent>(
        `/dev/payment-intents/${id}/simulate`,
        json("POST", { outcome }),
      ),
  );
export const useShopperOrders = (params: Params = {}) =>
  useQuery({
    queryKey: ["commerce", "orders", params],
    queryFn: () =>
      request<PageResponse<ShopperOrder>>(`/me/orders${query(params)}`),
  });
export const useShopperOrder = (id: string) =>
  useQuery({
    queryKey: ["commerce", "order", id],
    queryFn: () => request<OrderDetail>(`/me/orders/${id}`),
    enabled: !!id,
  });
export const useRetryPayment = () =>
  useCommerceMutation(
    ({
      parentOrderId,
      paymentMethod,
      idempotencyKey,
    }: {
      parentOrderId: string;
      paymentMethod: "WALLET" | "VIETQR";
      idempotencyKey: string;
    }) =>
      request<PaymentIntent>(
        `/me/orders/${parentOrderId}/pay`,
        json("POST", { paymentMethod }, idempotencyKey),
      ),
  );
export const useShopperOrderAction = () =>
  useCommerceMutation(
    ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: "cancel" | "confirm-received";
      reason?: string;
    }) =>
      request<OrderDetail>(
        `/me/orders/${id}/${action}`,
        json("POST", action === "cancel" ? { reason } : undefined),
      ),
  );
export const useOnboarding = () =>
  useQuery({
    queryKey: commerceKeys.seller("onboarding"),
    queryFn: () => request<Onboarding>("/seller/onboarding"),
  });
export const useSaveOnboarding = () =>
  useCommerceMutation(
    ({
      step,
      data,
    }: {
      step: OnboardingStep;
      data: NonNullable<OnboardingSteps[OnboardingStep]>;
    }) => request<Onboarding>(`/seller/onboarding/${step}`, json("PUT", data)),
  );
export const useSubmitOnboarding = () =>
  useCommerceMutation(() =>
    request<Onboarding>("/seller/onboarding/submit", json("POST")),
  );
export const useApproveOnboarding = () =>
  useCommerceMutation(() =>
    request<Onboarding>("/dev/seller/onboarding/approve", json("POST")),
  );
export const useSellerDashboard = () =>
  useQuery({
    queryKey: commerceKeys.seller("dashboard"),
    queryFn: () => request<SellerDashboard>("/seller/dashboard"),
  });
export const useSellerProducts = (params: Params = {}) =>
  useQuery({
    queryKey: ["commerce", "seller", "products", params],
    queryFn: () =>
      request<PageResponse<SellerProduct>>(`/seller/products${query(params)}`),
  });
export const useSellerProduct = (id: string) =>
  useQuery({
    queryKey: ["commerce", "seller", "product", id],
    queryFn: () => request<ProductDetail>(`/seller/products/${id}`),
    enabled: !!id,
  });
export const useSaveSellerProduct = () =>
  useCommerceMutation(({ id, data }: { id?: string; data: ProductWrite }) =>
    request<ProductDetail>(
      id ? `/seller/products/${id}` : "/seller/products",
      json(id ? "PUT" : "POST", data),
    ),
  );
export const useDuplicateSellerProduct = () =>
  useCommerceMutation(async (id: string) => {
    const original = await request<ProductDetail>(`/seller/products/${id}`);
    const data: ProductWrite = {
      name: `${original.name} (copy)`,
      categorySlug: original.category.slug,
      description: original.description,
      images: original.images,
      attributes: original.attributes,
      options: original.options,
      variants: original.variants.map((variant) => ({
        ...variant,
        id: undefined,
        sku: `${variant.sku}-COPY-${crypto.randomUUID().slice(0, 8)}`,
      })),
    };
    return request<ProductDetail>("/seller/products", json("POST", data));
  });
export const useSellerProductAction = () =>
  useCommerceMutation(
    ({ id, action }: { id: string; action: "submit" | "hide" | "unhide" }) =>
      request<ProductDetail>(`/seller/products/${id}/${action}`, json("POST")),
  );
export const useInventory = (params: Params = {}) =>
  useQuery({
    queryKey: ["commerce", "seller", "inventory", params],
    queryFn: () => request<InventoryRow[]>(`/seller/inventory${query(params)}`),
  });
export const useInventoryMovements = (id: string) =>
  useQuery({
    queryKey: ["commerce", "seller", "movements", id],
    queryFn: () =>
      request<InventoryMovement[]>(`/seller/inventory/${id}/movements`),
    enabled: !!id,
  });
export const useAdjustInventory = () =>
  useCommerceMutation(
    ({ id, ...data }: { id: string; delta: number; reason: string }) =>
      request(`/seller/inventory/${id}/adjust`, json("POST", data)),
  );
export const useSellerOrders = (params: Params = {}) =>
  useQuery({
    queryKey: ["commerce", "seller", "orders", params],
    queryFn: () =>
      request<PageResponse<SellerOrderDetail>>(
        `/seller/orders${query(params)}`,
      ),
  });
export const useSellerOrder = (id: string) =>
  useQuery({
    queryKey: ["commerce", "seller", "order", id],
    queryFn: () => request<SellerOrderDetail>(`/seller/orders/${id}`),
    enabled: !!id,
  });
export const useSellerOrderAction = () =>
  useCommerceMutation(
    ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: "confirm" | "reject" | "pack" | "handover";
      reason?: string;
    }) =>
      request<SellerOrderDetail>(
        `/seller/orders/${id}/${action}`,
        json("POST", action === "reject" ? { reason } : undefined),
      ),
  );
export const useSellerSettings = () =>
  useQuery({
    queryKey: commerceKeys.seller("settings"),
    queryFn: () => request<SellerSettings>("/seller/settings"),
  });
export const useSaveSellerSettings = () =>
  useCommerceMutation((data: SellerSettings) =>
    request<SellerSettings>("/seller/settings", json("PUT", data)),
  );
