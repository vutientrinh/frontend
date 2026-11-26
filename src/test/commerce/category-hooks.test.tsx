import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  useCategoryPreview,
  useCategoryTree,
} from "../../features/commerce/api";
import { commerceHandlers } from "../../mocks/commerce";
import { resetCommerceDB } from "../../mocks/commerce/db";
import { server } from "../setup";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  resetCommerceDB();
  server.use(...commerceHandlers);
});

describe("category data hooks", () => {
  it("builds an ordered tree from the flat categories response", async () => {
    const { result } = renderHook(() => useCategoryTree(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.data).toHaveLength(8));
    const roots = result.current.data!;
    expect(roots.map((root) => root.slug)).toEqual([
      "electronics",
      "home",
      "fashion",
      "beauty",
      "sports",
      "books",
      "toys",
      "food",
    ]);
    expect(roots[0].children.map((child) => child.name)).toEqual([
      "Phones",
      "Laptops",
      "Audio",
      "Wearables",
      "Accessories",
    ]);
  });

  it("defers category preview requests until a category is selected", async () => {
    const { result, rerender } = renderHook(
      ({ slug }: { slug: string | null }) => useCategoryPreview(slug),
      { initialProps: { slug: null as string | null }, wrapper: makeWrapper() },
    );
    expect(result.current.fetchStatus).toBe("idle");
    rerender({ slug: "electronics" });
    await waitFor(() => expect(result.current.data?.content).toHaveLength(4));
    expect(result.current.data?.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: expect.objectContaining({
            slug: expect.stringMatching(/^electronics-/),
          }),
        }),
      ]),
    );
  });
});
