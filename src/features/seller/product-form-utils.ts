import type { ProductDetail, ProductWrite } from "../commerce/types";

type ProductOption = ProductDetail["options"][number];
type ProductVariant = ProductWrite["variants"][number];

export type ProductDraft = Pick<
  ProductWrite,
  "name" | "categorySlug" | "description" | "images" | "variants"
> & { options: ProductOption[] };

export type ProductFormErrors = Partial<
  Record<
    "name" | "categorySlug" | "description" | "images" | "variants",
    string
  >
>;

const optionKey = (options: Record<string, string>) =>
  Object.entries(options)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}:${value}`)
    .join("|");

export function generateVariantMatrix(
  options: ProductOption[],
  current: ProductVariant[],
): ProductVariant[] {
  const usable = options
    .map(({ name, values }) => ({
      name: name.trim(),
      values: [...new Set(values.map((value) => value.trim()).filter(Boolean))],
    }))
    .filter((option) => option.name && option.values.length > 0);

  const combinations = usable.reduce<Record<string, string>[]>(
    (rows, option) =>
      rows.flatMap((row) =>
        option.values.map((value) => ({ ...row, [option.name]: value })),
      ),
    [{}],
  );
  const existing = new Map(
    current.map((variant) => [optionKey(variant.options), variant]),
  );
  const fallback = current[0];

  return combinations.map((combination) => {
    const match = existing.get(optionKey(combination));
    return {
      ...(match?.id ? { id: match.id } : {}),
      sku: match?.sku ?? "",
      options: combination,
      price: match?.price ?? fallback?.price ?? "",
      ...(match?.compareAtPrice
        ? { compareAtPrice: match.compareAtPrice }
        : fallback?.compareAtPrice
          ? { compareAtPrice: fallback.compareAtPrice }
          : {}),
      stock: match?.stock ?? 0,
      weightGrams: match?.weightGrams ?? fallback?.weightGrams ?? 500,
    };
  });
}

export function validateProductDraft(
  draft: ProductDraft,
  forReview = false,
): ProductFormErrors {
  const errors: ProductFormErrors = {};
  if (!draft.name.trim()) errors.name = "Enter a product name.";
  if (!draft.categorySlug) errors.categorySlug = "Choose a category.";
  if (!draft.description.trim())
    errors.description = "Add a product description.";
  if (forReview && draft.images.length < 3)
    errors.images = "Add at least 3 product images before saving.";
  if (
    forReview &&
    draft.options.some((option) => !option.name.trim() || !option.values.length)
  ) {
    errors.variants = "Complete each option name and add at least one value.";
  }
  if (
    forReview &&
    new Set(draft.options.map((option) => option.name.trim().toLowerCase()))
      .size !== draft.options.length
  ) {
    errors.variants = "Option names must be unique.";
  }
  if (!draft.variants.length) {
    errors.variants = "Add at least one variant.";
  } else if (
    draft.variants.some(
      (variant) =>
        !variant.sku.trim() ||
        !/^\d+$/.test(variant.price) ||
        BigInt(variant.price || "0") <= 0n ||
        (!!variant.compareAtPrice && !/^\d+$/.test(variant.compareAtPrice)) ||
        !/^[1-9]\d*$/.test(String(variant.weightGrams)) ||
        !Number.isInteger(variant.stock) ||
        variant.stock < 0,
    )
  ) {
    errors.variants =
      "Each variant needs a SKU, a whole-number price, non-negative stock, and a weight above zero.";
  }
  return errors;
}

export function productWriteFromDraft(
  draft: ProductDraft,
  attributes: ProductWrite["attributes"],
): ProductWrite {
  return {
    name: draft.name.trim(),
    categorySlug: draft.categorySlug,
    description: draft.description.trim(),
    images: draft.images,
    attributes: attributes.filter(
      (attribute) => attribute.name.trim() && attribute.value.trim(),
    ),
    options: draft.options
      .map((option) => ({
        name: option.name.trim(),
        values: [...new Set(option.values.map((value) => value.trim()))].filter(
          Boolean,
        ),
      }))
      .filter((option) => option.name && option.values.length),
    variants: draft.variants.map((variant) => ({
      ...variant,
      sku: variant.sku.trim(),
      compareAtPrice: variant.compareAtPrice || undefined,
    })),
  };
}
