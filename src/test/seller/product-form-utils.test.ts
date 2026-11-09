import { describe, expect, it } from "vitest";
import {
  generateVariantMatrix,
  validateProductDraft,
  type ProductDraft,
} from "../../features/seller/product-form-utils";

const validDraft = (overrides: Partial<ProductDraft> = {}): ProductDraft => ({
  name: "Travel mug",
  categorySlug: "home",
  description: "Insulated stainless steel mug.",
  images: [],
  options: [],
  variants: [
    {
      sku: "MUG-1",
      options: {},
      price: "120000",
      stock: 4,
      weightGrams: 500,
    },
  ],
  ...overrides,
});

describe("seller product form helpers", () => {
  it("generates every option combination and preserves matching variant data", () => {
    const current = [
      {
        id: "blue-small",
        sku: "MUG-BS",
        options: { Color: "Blue", Size: "S" },
        price: "125000",
        stock: 8,
        weightGrams: 550,
      },
    ];

    const variants = generateVariantMatrix(
      [
        { name: "Size", values: ["S", "M"] },
        { name: "Color", values: ["Blue", "Red"] },
      ],
      current,
    );

    expect(variants).toHaveLength(4);
    expect(variants[0]).toMatchObject({
      id: "blue-small",
      sku: "MUG-BS",
      options: { Size: "S", Color: "Blue" },
      price: "125000",
      stock: 8,
      weightGrams: 550,
    });
    expect(variants.slice(1).every((variant) => variant.sku === "")).toBe(true);
  });

  it("allows a draft without gallery images but requires three for review", () => {
    expect(validateProductDraft(validDraft())).toEqual({});
    expect(validateProductDraft(validDraft(), true)).toEqual({
      images: "Add at least 3 product images before saving.",
    });
    expect(
      validateProductDraft(
        validDraft({ images: ["one", "two", "three"] }),
        true,
      ),
    ).toEqual({});
  });

  it("reports required fields and invalid variant price and weight", () => {
    expect(
      validateProductDraft(
        validDraft({
          name: " ",
          categorySlug: "",
          description: "",
          variants: [
            {
              sku: " ",
              options: {},
              price: "0",
              stock: -1,
              weightGrams: 0,
            },
          ],
        }),
      ),
    ).toMatchObject({
      name: "Enter a product name.",
      categorySlug: "Choose a category.",
      description: "Add a product description.",
      variants: expect.stringContaining("Each variant needs a SKU"),
    });
  });
});
