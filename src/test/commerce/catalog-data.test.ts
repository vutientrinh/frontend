import { beforeEach, describe, expect, it } from "vitest";
import { server } from "../setup";
import type {
  CatalogHome,
  ProductDetail,
  ProductSummary,
} from "../../features/commerce/types";
import { commerceHandlers } from "../../mocks/commerce";
import {
  getDB,
  reloadCommerceDB,
  resetCommerceDB,
  seed,
} from "../../mocks/commerce/db";

const call = (path: string, token?: string) =>
  fetch(new URL(`/api${path}`, location.origin), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

beforeEach(() => {
  resetCommerceDB();
  server.use(...commerceHandlers);
});

describe("commerce catalog detail data", () => {
  it("seeds four deterministic SVG gallery images with light and dark surfaces", () => {
    const first = seed().products[0];
    const repeat = seed().products[0];
    const otherCategory = seed().products[1];

    expect(first.images).toHaveLength(4);
    expect(first.imageUrl).toBe(first.images[0]);
    expect(first.images).toEqual(repeat.images);
    expect(first.images[0]).not.toBe(otherCategory.images[0]);
    const svg = decodeURIComponent(first.images[0].split(",")[1]);
    expect(svg).toContain("<linearGradient");
    expect(svg).toContain("prefers-color-scheme: dark");
    expect(svg).toContain("<rect");
  });

  it("re-seeds stale v3 storage while preserving the banking auth store", async () => {
    const bankingStore = JSON.stringify({
      users: [
        {
          id: "shopper-1",
          phone: "0900000001",
          fullName: "Shopper",
          roles: ["SHOPPER"],
          status: "ACTIVE",
        },
      ],
      sessions: { oldToken: "shopper-1" },
      addresses: {},
    });
    localStorage.setItem(
      "payment-commerce-db-v3",
      JSON.stringify({ products: [{ id: "stale-product", slug: "stale" }] }),
    );
    localStorage.removeItem("payment-commerce-db-v4");
    localStorage.setItem("payment-banking-mock-v3", bankingStore);
    reloadCommerceDB();

    const product = getDB().products[0];
    expect(product.specs?.length).toBeGreaterThan(0);
    expect(product.reviews?.length).toBeGreaterThan(0);
    expect(product.shippingEstimate).toBeDefined();
    expect(localStorage.getItem("payment-commerce-db-v3")).toBeNull();
    expect(localStorage.getItem("payment-commerce-db-v4")).not.toBeNull();
    expect(localStorage.getItem("payment-banking-mock-v3")).toBe(bankingStore);
    expect((await call("/cart", "oldToken")).status).toBe(200);
  });

  it("migrates persisted placeholder categories without resetting commerce data", () => {
    const persisted = seed();
    const roots = persisted.categories.filter(
      (category) => category.parentId === null,
    );
    const oldCategories = roots.flatMap((root) => [
      { ...root, iconName: "Package" },
      {
        id: `old-${root.id}`,
        slug: `${root.slug}-essentials`,
        name: `${root.name} essentials`,
        parentId: root.id,
        iconName: "Package",
        attributes: root.attributes,
      },
    ]);
    for (const product of persisted.products) {
      const leaf = persisted.categories.find(
        (category) => category.slug === product.category.slug,
      )!;
      const parent = persisted.categories.find(
        (category) => category.id === leaf.parentId,
      )!;
      product.category = { slug: parent.slug, name: parent.name };
    }
    persisted.categories = oldCategories;
    delete (persisted as Partial<typeof persisted>).notificationReadAt;
    const previousOrderCount = persisted.orders.length;
    localStorage.setItem("payment-commerce-db-v4", JSON.stringify(persisted));
    reloadCommerceDB();

    const migrated = getDB();
    expect(
      migrated.categories.some((category) =>
        / essentials$/i.test(category.name),
      ),
    ).toBe(false);
    expect(migrated.categories).toHaveLength(48);
    expect(migrated.products).toHaveLength(persisted.products.length);
    expect(migrated.orders).toHaveLength(previousOrderCount);
    expect(migrated.notificationReadAt).toEqual({});
    expect(
      migrated.products.every((product) =>
        migrated.categories.some(
          (category) =>
            category.slug === product.category.slug && category.parentId,
        ),
      ),
    ).toBe(true);
  });

  it("includes optional variant counts in home, search, and seller catalog results", async () => {
    const home = (await (await call("/catalog/home")).json()) as CatalogHome;
    const homeProducts = [...home.deals, ...home.recommended];
    expect(homeProducts.length).toBeGreaterThan(0);
    for (const product of homeProducts) {
      expect(product.variantCount).toBe(
        getDB().products.find((seeded) => seeded.slug === product.slug)
          ?.variants.length,
      );
    }

    const sellerSlug = getDB().sellers[0].slug;
    const search = (await (
      await call(`/catalog/products?q=item&sellerSlug=${sellerSlug}`)
    ).json()) as { content: ProductSummary[] };
    expect(search.content.length).toBeGreaterThan(0);
    for (const product of search.content) {
      expect(product.variantCount).toBe(
        getDB().products.find((seeded) => seeded.slug === product.slug)
          ?.variants.length,
      );
    }
  });

  it("serves optional specs, reviews, rating breakdown, and shipping estimate", async () => {
    const product = getDB().products[4];
    const response = await call(`/catalog/products/${product.slug}`);
    expect(response.status).toBe(200);
    const detail = (await response.json()) as ProductDetail;

    expect(detail.specs?.length).toBeGreaterThan(0);
    expect(detail.reviews?.length).toBeGreaterThan(0);
    expect(detail.ratingBreakdown).toBeDefined();
    expect(
      Object.values(detail.ratingBreakdown!).reduce((a, b) => a + b, 0),
    ).toBe(detail.ratingCount);
    expect(detail.shippingEstimate).toMatchObject({
      destination: product.seller.location,
      fee: "25000",
    });
    expect(detail.shippingEstimate!.minDays).toBeLessThanOrEqual(
      detail.shippingEstimate!.maxDays,
    );
  });

  it("keeps seeded product categories aligned with each seller's assortment", () => {
    const db = getDB();
    const products = db.products;
    const sellerCategories = new Map<string, Set<string>>();
    for (const product of products) {
      const categories = sellerCategories.get(product.seller.slug) ?? new Set();
      const leaf = db.categories.find(
        (category) => category.slug === product.category.slug,
      );
      const parent = db.categories.find(
        (category) => category.id === leaf?.parentId,
      );
      categories.add(parent?.slug ?? product.category.slug);
      sellerCategories.set(product.seller.slug, categories);
    }

    expect([...sellerCategories.get("saigon-gadget-house")!]).toEqual([
      "electronics",
    ]);
    expect([...sellerCategories.get("hanoi-home-living")!].sort()).toEqual([
      "beauty",
      "books",
      "food",
      "home",
    ]);
    expect([...sellerCategories.get("da-nang-outdoor")!].sort()).toEqual([
      "fashion",
      "sports",
      "toys",
    ]);
  });

  it("seeds a populated two-level category tree with distinct top-level icons", () => {
    const db = seed();
    const roots = db.categories.filter(
      (category) => category.parentId === null,
    );
    expect(roots).toHaveLength(8);
    expect(new Set(roots.map((category) => category.iconName)).size).toBe(8);
    expect(
      db.categories.some((category) => category.name.endsWith("essentials")),
    ).toBe(false);

    for (const root of roots) {
      const leaves = db.categories.filter(
        (category) => category.parentId === root.id,
      );
      expect(leaves).toHaveLength(5);
      for (const leaf of leaves) {
        expect(
          db.products.some(
            (product) =>
              product.status === "LIVE" && product.category.slug === leaf.slug,
          ),
        ).toBe(true);
      }
    }
  });

  it("returns LIVE counts for leaves and parents, and parent filters include child products", async () => {
    const categoryResponse = await call("/catalog/categories");
    expect(categoryResponse.status).toBe(200);
    const categories = (await categoryResponse.json()) as {
      id: string;
      slug: string;
      parentId: string | null;
      productCount: number;
    }[];
    const roots = categories.filter((category) => category.parentId === null);
    for (const category of categories) {
      const expected = getDB().products.filter(
        (product) =>
          product.status === "LIVE" &&
          (product.category.slug === category.slug ||
            (category.parentId === null &&
              categories.some(
                (child) =>
                  child.parentId === category.id &&
                  child.slug === product.category.slug,
              ))),
      ).length;
      expect(category.productCount).toBe(expected);
    }
    const electronics = roots.find(
      (category) => category.slug === "electronics",
    )!;
    const productResponse = await call(
      `/catalog/products?category=${electronics.slug}&size=100`,
    );
    const result = (await productResponse.json()) as {
      totalElements: number;
      content: { category: { slug: string } }[];
    };
    expect(result.totalElements).toBe(electronics.productCount);
    expect(
      result.content.every(
        (product) => product.category.slug !== "electronics",
      ),
    ).toBe(true);
  });

  it("spreads seeded order and shipment timestamps across the order lifecycle", () => {
    const orders = getDB().orders;
    const allTimelineTimes = new Set<string>();
    for (const order of orders) {
      expect(order.timeline.at(-1)?.status).toBe(order.status);
      expect(order.createdAt).toBe(order.timeline[0].at);
      for (let i = 0; i < order.timeline.length; i++) {
        allTimelineTimes.add(order.timeline[i].at);
        if (i > 0)
          expect(Date.parse(order.timeline[i].at)).toBeGreaterThan(
            Date.parse(order.timeline[i - 1].at),
          );
      }
      if (order.shipment) {
        for (let i = 1; i < order.shipment.events.length; i++)
          expect(Date.parse(order.shipment.events[i].at)).toBeGreaterThan(
            Date.parse(order.shipment.events[i - 1].at),
          );
      }
    }
    expect(allTimelineTimes.size).toBeGreaterThan(20);
  });
});
