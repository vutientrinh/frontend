import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { useBlocker, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Check, ImagePlus, Plus, X } from "lucide-react";
import Big from "big.js";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { SearchCombobox } from "../../components/SearchCombobox";
import { MoneyText } from "../../components/shared";
import {
  useCategories,
  useSaveSellerProduct,
  useSellerProductAction,
} from "../commerce/api";
import type { Category, ProductDetail, ProductWrite } from "../commerce/types";
import {
  generateVariantMatrix,
  productWriteFromDraft,
  validateProductDraft,
  type ProductDraft,
  type ProductFormErrors,
} from "./product-form-utils";

const sectionClass = "scroll-mt-24 rounded-lg border border-border bg-card p-5";
const fieldClass = "grid gap-2 text-small font-medium";
const inputClass = "min-h-11 text-body";
const defaultVariant: ProductWrite["variants"][number] = {
  sku: "",
  options: {},
  price: "",
  stock: 0,
  weightGrams: 500,
};

function categoryPath(category: Category, categories: Category[]) {
  const parent = categories.find((item) => item.id === category.parentId);
  return parent ? `${parent.name} / ${category.name}` : category.name;
}

function productSnapshot(product?: ProductDetail) {
  const payload = productWriteFromDraft(
    {
      name: product?.name ?? "",
      categorySlug: product?.category.slug ?? "",
      description: product?.description ?? "",
      images: product?.images ?? [],
      options: product?.options ?? [],
      variants: product?.variants ?? [{ ...defaultVariant }],
    },
    product?.attributes ?? [],
  );
  if (product?.shippingDimensions)
    payload.shippingDimensions = product.shippingDimensions;
  return JSON.stringify(payload);
}

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error(`Could not read ${file.name}.`));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function InlineError({ id, children }: { id: string; children?: string }) {
  return children ? (
    <p id={id} className="text-sm font-normal text-destructive">
      {children}
    </p>
  ) : null;
}

function ProductPreview({
  name,
  description,
  image,
  price,
  category,
  checklist,
}: {
  name: string;
  description: string;
  image?: string;
  price?: string;
  category: string;
  checklist: { label: string; complete: boolean }[];
}) {
  return (
    <aside
      className="h-fit lg:sticky lg:top-4"
      aria-label="Live product preview"
    >
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="font-semibold">Live preview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Updates as you edit
          </p>
        </div>
        <div className="p-4">
          <article className="overflow-hidden rounded-lg border border-border">
            <div className="aspect-square bg-muted">
              {image ? (
                <img
                  src={image}
                  alt={name ? `${name} product preview` : "Product preview"}
                  width={480}
                  height={480}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <ImagePlus size={32} aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="space-y-1.5 p-3">
              <p className="line-clamp-2 font-medium">
                {name || "Product name"}
              </p>
              <p className="text-sm text-muted-foreground">
                {category || "Choose a category"}
              </p>
              <p className="font-semibold tabular-nums">
                {price ? <MoneyText amount={price} /> : "Set a price"}
              </p>
            </div>
          </article>
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Product page preview</h3>
            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
              {description || "Your description will appear here."}
            </p>
            <Button className="mt-3 w-full" disabled>
              Add to cart
            </Button>
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Completeness</h3>
            <ul className="mt-2 grid gap-2 text-sm">
              {checklist.map(({ label, complete }) => (
                <li key={label} className="flex items-center gap-2">
                  <span
                    className={
                      complete
                        ? "text-status-completed"
                        : "text-muted-foreground"
                    }
                    aria-hidden="true"
                  >
                    {complete ? <Check size={16} /> : "○"}
                  </span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </aside>
  );
}

export function ProductForm({ product }: { product?: ProductDetail }) {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const categories = useCategories();
  const save = useSaveSellerProduct();
  const submitReview = useSellerProductAction();
  const [name, setName] = useState(product?.name ?? "");
  const [categorySlug, setCategorySlug] = useState(
    product?.category.slug ?? "",
  );
  const [description, setDescription] = useState(product?.description ?? "");
  const [images, setImages] = useState(product?.images ?? []);
  const [variants, setVariants] = useState<ProductWrite["variants"]>(
    product?.variants ?? [{ ...defaultVariant }],
  );
  const [options, setOptions] = useState(product?.options ?? []);
  const [attributes, setAttributes] = useState<ProductWrite["attributes"]>(
    product?.attributes ?? [],
  );
  const [dimensions, setDimensions] = useState(
    product?.shippingDimensions ?? { lengthCm: 0, widthCm: 0, heightCm: 0 },
  );
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [imageError, setImageError] = useState("");
  const [serverError, setServerError] = useState("");
  const [valueInputs, setValueInputs] = useState<Record<number, string>>({});
  const [persistedId, setPersistedId] = useState(product?.id);
  const [savingForReview, setSavingForReview] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState(() =>
    productSnapshot(product),
  );

  const draft: ProductDraft = {
    name,
    categorySlug,
    description,
    images,
    options,
    variants,
  };
  const data = productWriteFromDraft(draft, attributes);
  const hasDimensions = Object.values(dimensions).some((value) => value > 0);
  data.shippingDimensions = hasDimensions ? dimensions : undefined;
  const snapshot = JSON.stringify(data);
  const isDirty =
    snapshot !== initialSnapshot ||
    Object.values(valueInputs).some((value) => value.trim().length > 0);
  const blocker = useBlocker(
    isDirty && !save.isPending && !submitReview.isPending,
  );
  useEffect(() => {
    if (!isDirty) return;
    const preventClose = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventClose);
    return () => window.removeEventListener("beforeunload", preventClose);
  }, [isDirty]);

  const selectedCategory = categories.data?.find(
    (item) => item.slug === categorySlug,
  );
  const categoryOptions = useMemo(
    () =>
      (categories.data ?? []).map((item) => ({
        value: item.slug,
        label: categoryPath(item, categories.data ?? []),
      })),
    [categories.data],
  );
  const customFields = selectedCategory?.attributes ?? [];
  const firstPrice = variants.find((variant) =>
    /^\d+$/.test(variant.price),
  )?.price;
  const prices = variants
    .map((variant) => variant.price)
    .filter((price) => /^\d+$/.test(price))
    .sort((a, b) => (new Big(a).lt(b) ? -1 : new Big(a).gt(b) ? 1 : 0));
  const checklist = [
    { label: "Add 3 or more images", complete: images.length >= 3 },
    { label: "Set a product name", complete: !!name.trim() },
    { label: "Choose a category", complete: !!categorySlug },
    { label: "Write a description", complete: !!description.trim() },
    {
      label: "Set a price and SKU",
      complete: variants.every(
        (variant) => !!variant.price && !!variant.sku.trim(),
      ),
    },
  ];

  const setField = (
    field: keyof ProductFormErrors,
    value: string,
    setter: (next: string) => void,
  ) => {
    setter(value);
    if (errors[field]) {
      const nextErrors = { ...errors };
      delete nextErrors[field];
      setErrors(nextErrors);
    }
  };

  const addFiles = async (fileList: FileList | File[]) => {
    setImageError("");
    const selected = Array.from(fileList).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (selected.length !== fileList.length) {
      setImageError("Choose image files only.");
      return;
    }
    if (images.length + selected.length > 9) {
      setImageError("You can add up to 9 images.");
      return;
    }
    if (selected.some((file) => file.size > 1_000_000)) {
      setImageError("Each image must be 1 MB or smaller for mock storage.");
      return;
    }
    const existingSize = images.reduce(
      (total, image) =>
        total + Math.floor(((image.length - image.indexOf(",") - 1) * 3) / 4),
      0,
    );
    if (
      existingSize + selected.reduce((total, file) => total + file.size, 0) >
      3_000_000
    ) {
      setImageError(
        "Keep the combined image size under 3 MB for mock storage.",
      );
      return;
    }
    try {
      const dataUrls = await Promise.all(selected.map(readImage));
      setImages((current) => [...current, ...dataUrls]);
    } catch (error) {
      setImageError(
        error instanceof Error ? error.message : "Could not read images.",
      );
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) void addFiles(event.target.files);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files.length)
      void addFiles(event.dataTransfer.files);
  };

  const updateOptions = (next: typeof options) => {
    setOptions(next);
    setVariants((current) => generateVariantMatrix(next, current));
    setErrors((current) => ({ ...current, variants: undefined }));
  };

  const updateVariant = (
    index: number,
    key: keyof ProductWrite["variants"][number],
    value: string,
  ) => {
    setVariants((current) =>
      current.map((variant, row) =>
        row !== index
          ? variant
          : {
              ...variant,
              [key]:
                key === "stock" || key === "weightGrams"
                  ? Number(value)
                  : value,
            },
      ),
    );
    if (errors.variants)
      setErrors((current) => ({ ...current, variants: undefined }));
  };

  const validateVariantsOnBlur = () => {
    const validation = validateProductDraft(draft);
    setErrors((current) => ({
      ...current,
      variants: validation.variants,
    }));
  };

  const updateOptionValue = (index: number, value: string) => {
    const option = options[index];
    if (!option || !value.trim()) return;
    if (
      option.values.some(
        (item) => item.toLowerCase() === value.trim().toLowerCase(),
      )
    ) {
      setValueInputs((current) => ({ ...current, [index]: "" }));
      return;
    }
    updateOptions(
      options.map((item, row) =>
        row === index
          ? { ...item, values: [...item.values, value.trim()] }
          : item,
      ),
    );
  };

  const setAttributeValue = (attributeName: string, value: string) => {
    setAttributes((current) => {
      const found = current.some((item) => item.name === attributeName);
      return found
        ? current.map((item) =>
            item.name === attributeName ? { ...item, value } : item,
          )
        : [...current, { name: attributeName, value }];
    });
  };

  const saveProduct = async (forReview: boolean) => {
    setServerError("");
    setSavingForReview(forReview);
    const result = validateProductDraft(draft, forReview);
    setErrors(result);
    if (Object.keys(result).length) {
      setSavingForReview(false);
      requestAnimationFrame(() => {
        if (result.name)
          formRef.current
            ?.querySelector<HTMLInputElement>('[name="name"]')
            ?.focus();
        else if (result.categorySlug)
          formRef.current
            ?.querySelector<HTMLButtonElement>('button[aria-label="Category"]')
            ?.focus();
        else if (result.description)
          formRef.current
            ?.querySelector<HTMLTextAreaElement>('[name="description"]')
            ?.focus();
        else if (result.images)
          formRef.current
            ?.querySelector<HTMLInputElement>('[name="image-upload"]')
            ?.focus();
        else
          formRef.current
            ?.querySelector<HTMLInputElement>('[aria-invalid="true"]')
            ?.focus();
      });
      return;
    }
    try {
      const saved = await save.mutateAsync({
        id: persistedId,
        data,
      });
      setPersistedId(saved.id);
      setInitialSnapshot(snapshot);
      if (forReview) {
        await submitReview.mutateAsync({ id: saved.id, action: "submit" });
      }
      navigate(`/seller/products/${saved.id}`);
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Unable to save product.",
      );
    } finally {
      setSavingForReview(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void saveProduct(false);
  };

  const fieldError = (field: keyof ProductFormErrors) => errors[field];

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="pb-24">
      {Object.keys(errors).length > 0 && (
        <div
          role="alert"
          className="mb-5 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <h2 className="font-semibold">Fix these fields before saving</h2>
          <ul className="mt-2 list-disc pl-5">
            {Object.values(errors)
              .filter(Boolean)
              .map((message) => (
                <li key={message}>{message}</li>
              ))}
          </ul>
        </div>
      )}
      {serverError && (
        <p
          role="alert"
          className="mb-5 rounded-md border border-destructive/40 p-4 text-sm text-destructive"
        >
          {serverError}
        </p>
      )}
      {blocker.state === "blocked" && (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-status-pending/40 bg-status-pending/5 p-4"
        >
          <p className="text-sm">
            You have unsaved product changes. Leave and discard them?
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              className="border border-border bg-transparent text-foreground hover:bg-muted"
              onClick={() => blocker.reset()}
            >
              Keep editing
            </Button>
            <Button type="button" onClick={() => blocker.proceed()}>
              Leave without saving
            </Button>
          </div>
        </div>
      )}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 content-start gap-5">
          <nav
            aria-label="Product form sections"
            className="flex flex-wrap gap-2 text-sm"
          >
            {[
              ["basic-info", "Basic info"],
              ["media", "Media"],
              ["options", "Options & variants"],
              ["pricing", "Pricing"],
              ["shipping", "Shipping"],
              ["attributes", "Category attributes"],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded border border-border px-3 py-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {label}
              </a>
            ))}
          </nav>

          <section id="basic-info" className={sectionClass}>
            <h2 className="text-lg font-semibold">Basic info</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Give shoppers the details they need to find your product.
            </p>
            <div className="grid gap-4">
              <label className={fieldClass}>
                Product name <span className="text-destructive">*</span>
                <Input
                  name="name"
                  autoComplete="off"
                  maxLength={120}
                  value={name}
                  aria-invalid={!!fieldError("name")}
                  aria-describedby={
                    fieldError("name") ? "name-error name-count" : "name-count"
                  }
                  onChange={(event) =>
                    setField("name", event.target.value, setName)
                  }
                  onBlur={() => {
                    if (!name.trim())
                      setErrors((current) => ({
                        ...current,
                        name: "Enter a product name.",
                      }));
                  }}
                />
                <span
                  id="name-count"
                  className="font-normal text-muted-foreground"
                >
                  {name.length}/120 characters
                </span>
                <InlineError id="name-error">{fieldError("name")}</InlineError>
              </label>
              <div className={fieldClass}>
                <span>
                  Category <span className="text-destructive">*</span>
                </span>
                {categories.isLoading ? (
                  <div
                    role="status"
                    className="h-11 animate-pulse rounded bg-muted"
                    aria-label="Loading categories"
                  />
                ) : categories.isError ? (
                  <div role="alert" className="text-sm text-destructive">
                    Categories could not load.{" "}
                    <Button onClick={() => void categories.refetch()}>
                      Retry
                    </Button>
                  </div>
                ) : (
                  <SearchCombobox
                    label="Category"
                    value={categorySlug}
                    options={categoryOptions}
                    onChange={(value) => {
                      setCategorySlug(value);
                      const nextCategory = categories.data?.find(
                        (item) => item.slug === value,
                      );
                      const accepted = new Set(nextCategory?.attributes ?? []);
                      setAttributes((current) =>
                        current.filter((item) => accepted.has(item.name)),
                      );
                      setErrors((current) => ({
                        ...current,
                        categorySlug: undefined,
                      }));
                    }}
                  />
                )}
                <InlineError id="category-error">
                  {fieldError("categorySlug")}
                </InlineError>
              </div>
              <label className={fieldClass}>
                Description <span className="text-destructive">*</span>
                <textarea
                  name="description"
                  maxLength={3000}
                  value={description}
                  aria-invalid={!!fieldError("description")}
                  aria-describedby={
                    fieldError("description")
                      ? "description-error description-count"
                      : "description-count"
                  }
                  onChange={(event) =>
                    setField("description", event.target.value, setDescription)
                  }
                  onBlur={() => {
                    if (!description.trim())
                      setErrors((current) => ({
                        ...current,
                        description: "Add a product description.",
                      }));
                  }}
                  className="min-h-32 rounded-md border border-border bg-background p-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2"
                />
                <span
                  id="description-count"
                  className="font-normal text-muted-foreground"
                >
                  {description.length}/3000 characters
                </span>
                <InlineError id="description-error">
                  {fieldError("description")}
                </InlineError>
              </label>
            </div>
          </section>

          <section id="media" className={sectionClass}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Media</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add up to 9 images. The first image is the cover. Image data
                  stays in this mock browser.
                </p>
              </div>
              <span className="text-sm tabular-nums text-muted-foreground">
                {images.length}/9
              </span>
            </div>
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
              className="mt-4 rounded-md border border-dashed border-border p-5 text-center"
            >
              <ImagePlus
                className="mx-auto mb-2 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm">Drop images here or choose files</p>
              <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted focus-within:outline-2 focus-within:outline-offset-2">
                Add images
                <input
                  name="image-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={images.length >= 9}
                  onChange={onFileChange}
                  className="sr-only"
                  aria-label="Add product images"
                  aria-invalid={!!fieldError("images")}
                  aria-describedby={
                    fieldError("images") ? "images-error" : undefined
                  }
                />
              </label>
            </div>
            {imageError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {imageError}
              </p>
            )}
            {fieldError("images") && (
              <p id="images-error" className="mt-3 text-sm text-destructive">
                {fieldError("images")}
              </p>
            )}
            {images.length > 0 && (
              <ul
                className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"
                aria-label="Product images"
              >
                {images.map((image, index) => (
                  <li
                    key={`${index}-${image.slice(-24)}`}
                    className="overflow-hidden rounded-md border border-border"
                  >
                    <div className="aspect-square bg-muted">
                      <img
                        src={image}
                        alt={`Product image ${index + 1}`}
                        width={320}
                        height={320}
                        className="size-full object-cover"
                      />
                    </div>
                    <div className="flex min-h-11 items-center justify-between gap-1 p-2">
                      <span className="truncate font-mono text-caption">
                        {index === 0 ? "Cover image" : `Image ${index + 1}`}
                      </span>
                      <div className="flex items-center gap-1">
                        {index > 0 && (
                          <Button
                            type="button"
                            aria-label={`Set image ${index + 1} as cover`}
                            className="min-h-11 px-2 text-xs"
                            onClick={() =>
                              setImages((current) => [
                                current[index],
                                ...current.filter((_, row) => row !== index),
                              ])
                            }
                          >
                            Set cover
                          </Button>
                        )}
                        <Button
                          type="button"
                          aria-label={`Move image ${index + 1} earlier`}
                          disabled={index === 0}
                          className="size-9 px-0"
                          onClick={() =>
                            setImages((current) =>
                              current.map((value, row) =>
                                row === index - 1
                                  ? current[index]
                                  : row === index
                                    ? current[index - 1]
                                    : value,
                              ),
                            )
                          }
                        >
                          <ArrowUp size={15} aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          aria-label={`Move image ${index + 1} later`}
                          disabled={index === images.length - 1}
                          className="size-9 px-0"
                          onClick={() =>
                            setImages((current) =>
                              current.map((value, row) =>
                                row === index
                                  ? current[index + 1]
                                  : row === index + 1
                                    ? current[index]
                                    : value,
                              ),
                            )
                          }
                        >
                          <ArrowDown size={15} aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          aria-label={`Remove image ${index + 1}`}
                          className="size-9 px-0"
                          onClick={() =>
                            setImages((current) =>
                              current.filter((_, row) => row !== index),
                            )
                          }
                        >
                          <X size={15} aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="options" className={sectionClass}>
            <h2 className="text-lg font-semibold">Options & variants</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Add option values to generate every combination. You can edit SKU
              and inventory for each variant below.
            </p>
            <div className="grid gap-4">
              {options.map((option, index) => (
                <div
                  key={`option-${index}`}
                  className="rounded-md border border-border p-4"
                >
                  <div className="flex items-end gap-2">
                    <label className={`${fieldClass} flex-1`}>
                      Option name
                      <Input
                        className={inputClass}
                        value={option.name}
                        placeholder="e.g. Size…"
                        onChange={(event) =>
                          updateOptions(
                            options.map((item, row) =>
                              row === index
                                ? { ...item, name: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <Button
                      type="button"
                      aria-label={`Remove option ${option.name || index + 1}`}
                      className="min-h-11"
                      onClick={() =>
                        updateOptions(options.filter((_, row) => row !== index))
                      }
                    >
                      Remove option
                    </Button>
                  </div>
                  <label className={`${fieldClass} mt-3`}>
                    Values
                    <Input
                      className={inputClass}
                      value={valueInputs[index] ?? ""}
                      placeholder={`Add a ${option.name || "option"} value…`}
                      aria-label={`Add value for ${option.name || `option ${index + 1}`}`}
                      onChange={(event) =>
                        setValueInputs((current) => ({
                          ...current,
                          [index]: event.target.value,
                        }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          updateOptionValue(index, valueInputs[index] ?? "");
                          setValueInputs((current) => ({
                            ...current,
                            [index]: "",
                          }));
                        }
                      }}
                    />
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {option.values.map((value) => (
                      <span
                        key={value}
                        className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border px-3 text-sm"
                      >
                        {value}
                        <button
                          type="button"
                          aria-label={`Remove ${value} from ${option.name}`}
                          className="rounded-full p-1 hover:bg-muted focus-visible:outline-2"
                          onClick={() =>
                            updateOptions(
                              options.map((item, row) =>
                                row === index
                                  ? {
                                      ...item,
                                      values: item.values.filter(
                                        (current) => current !== value,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                        >
                          <X size={13} aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                    {!option.values.length && (
                      <span className="text-sm text-muted-foreground">
                        Type a value and press Enter.
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <Button
                type="button"
                className="w-fit"
                onClick={() =>
                  updateOptions([...options, { name: "", values: [] }])
                }
              >
                <Plus size={16} className="mr-2" aria-hidden="true" />
                Add option
              </Button>
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Variant matrix</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {variants.length} variant{variants.length === 1 ? "" : "s"}{" "}
                    generated
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className={fieldClass}>
                    Apply price
                    <Input
                      aria-label="Bulk price"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={bulkPrice}
                      onChange={(event) => setBulkPrice(event.target.value)}
                    />
                  </label>
                  <label className={fieldClass}>
                    Apply stock
                    <Input
                      aria-label="Bulk stock"
                      type="number"
                      min="0"
                      value={bulkStock}
                      onChange={(event) => setBulkStock(event.target.value)}
                    />
                  </label>
                  <Button
                    type="button"
                    className="min-h-11"
                    onClick={() =>
                      setVariants((current) =>
                        current.map((variant) => ({
                          ...variant,
                          ...(bulkPrice ? { price: bulkPrice } : {}),
                          ...(bulkStock !== ""
                            ? { stock: Number(bulkStock) }
                            : {}),
                        })),
                      )
                    }
                  >
                    Apply to all
                  </Button>
                </div>
              </div>
              {fieldError("variants") && (
                <p
                  id="variants-error"
                  className="mt-3 text-sm text-destructive"
                >
                  {fieldError("variants")}
                </p>
              )}
              <div className="mt-3 overflow-x-auto rounded-md border border-border">
                <table className="min-w-[860px] w-full text-left text-small">
                  <thead className="bg-muted">
                    <tr>
                      {[
                        "Options",
                        "SKU *",
                        "Price (VND) *",
                        "Compare at (VND)",
                        "Stock *",
                        "Weight (g) *",
                      ].map((heading) => (
                        <th scope="col" key={heading} className="p-3">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((variant, index) => (
                      <tr
                        key={
                          variant.id ??
                          `${Object.values(variant.options).join("-")}-${index}`
                        }
                        className="border-t border-border"
                      >
                        <th scope="row" className="max-w-40 p-3 font-medium">
                          {Object.entries(variant.options)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(" · ") || "Default variant"}
                        </th>
                        <td className="p-2">
                          <Input
                            aria-label={`SKU for variant ${index + 1}`}
                            aria-invalid={!!fieldError("variants")}
                            aria-describedby={
                              fieldError("variants")
                                ? "variants-error"
                                : undefined
                            }
                            className="font-mono text-caption"
                            value={variant.sku}
                            onChange={(event) =>
                              updateVariant(index, "sku", event.target.value)
                            }
                            onBlur={validateVariantsOnBlur}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            aria-label={`Price for variant ${index + 1}`}
                            aria-invalid={!!fieldError("variants")}
                            aria-describedby={
                              fieldError("variants")
                                ? "variants-error"
                                : undefined
                            }
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={variant.price}
                            onChange={(event) =>
                              updateVariant(index, "price", event.target.value)
                            }
                            onBlur={validateVariantsOnBlur}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            aria-label={`Compare at price for variant ${index + 1}`}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={variant.compareAtPrice ?? ""}
                            onChange={(event) =>
                              updateVariant(
                                index,
                                "compareAtPrice",
                                event.target.value,
                              )
                            }
                            onBlur={validateVariantsOnBlur}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            aria-label={`Stock for variant ${index + 1}`}
                            aria-invalid={!!fieldError("variants")}
                            aria-describedby={
                              fieldError("variants")
                                ? "variants-error"
                                : undefined
                            }
                            type="number"
                            min="0"
                            value={variant.stock}
                            onChange={(event) =>
                              updateVariant(index, "stock", event.target.value)
                            }
                            onBlur={validateVariantsOnBlur}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            aria-label={`Weight for variant ${index + 1}`}
                            aria-invalid={!!fieldError("variants")}
                            aria-describedby={
                              fieldError("variants")
                                ? "variants-error"
                                : undefined
                            }
                            type="number"
                            min="1"
                            value={variant.weightGrams}
                            onChange={(event) =>
                              updateVariant(
                                index,
                                "weightGrams",
                                event.target.value,
                              )
                            }
                            onBlur={validateVariantsOnBlur}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section id="pricing" className={sectionClass}>
            <h2 className="text-lg font-semibold">Pricing summary</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Variant count</dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {variants.length}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Price range</dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {prices.length ? (
                    prices.length > 1 &&
                    prices[0] !== prices[prices.length - 1] ? (
                      <>
                        <MoneyText amount={prices[0]} size="small" /> –{" "}
                        <MoneyText
                          amount={prices[prices.length - 1]}
                          size="small"
                        />
                      </>
                    ) : (
                      <MoneyText amount={prices[0]} size="small" />
                    )
                  ) : (
                    "Set a price for each variant"
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section id="shipping" className={sectionClass}>
            <h2 className="text-lg font-semibold">Shipping</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Each variant has its own shipping weight. Add packed dimensions to
              improve shipping estimates.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["lengthCm", "widthCm", "heightCm"] as const).map(
                (dimension) => (
                  <label key={dimension} className={fieldClass}>
                    {dimension === "lengthCm"
                      ? "Length (cm)"
                      : dimension === "widthCm"
                        ? "Width (cm)"
                        : "Height (cm)"}
                    <Input
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={dimensions[dimension] || ""}
                      placeholder="e.g. 20…"
                      onChange={(event) =>
                        setDimensions((current) => ({
                          ...current,
                          [dimension]: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                ),
              )}
            </div>
          </section>

          <section id="attributes" className={sectionClass}>
            <h2 className="text-lg font-semibold">Category attributes</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              These details help shoppers compare products in{" "}
              {selectedCategory?.name || "your chosen category"}.
            </p>
            {selectedCategory ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {customFields.map((attributeName) => (
                  <label key={attributeName} className={fieldClass}>
                    {attributeName}
                    <Input
                      className={inputClass}
                      value={
                        attributes.find((item) => item.name === attributeName)
                          ?.value ?? ""
                      }
                      placeholder={`Enter ${attributeName.toLowerCase()}…`}
                      onChange={(event) =>
                        setAttributeValue(attributeName, event.target.value)
                      }
                    />
                  </label>
                ))}
                {!customFields.length && (
                  <p className="text-sm text-muted-foreground">
                    No category-specific attributes are configured.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Choose a category to see its attributes.
              </p>
            )}
          </section>
        </div>

        <ProductPreview
          name={name}
          description={description}
          image={images[0]}
          price={firstPrice}
          category={
            selectedCategory
              ? categoryPath(selectedCategory, categories.data ?? [])
              : ""
          }
          checklist={checklist}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              className="border border-border bg-transparent text-foreground hover:bg-muted"
              onClick={() => navigate("/seller/products")}
            >
              Cancel
            </Button>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {isDirty ? "Unsaved changes" : "All changes saved"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              disabled={save.isPending || savingForReview}
              className="border border-border bg-transparent text-foreground hover:bg-muted"
            >
              {save.isPending && !savingForReview ? "Saving…" : "Save draft"}
            </Button>
            <Button
              type="button"
              disabled={
                save.isPending ||
                submitReview.isPending ||
                (product && !["DRAFT", "REJECTED"].includes(product.status))
              }
              onClick={() => void saveProduct(true)}
            >
              {savingForReview ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
