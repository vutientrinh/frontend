import { useState, type FormEvent } from "react";
import Big from "big.js";
import type { Category } from "../../commerce/types";
import { activeFacetCount, type Facets } from "../lib";

const RATINGS = [
  { value: "", label: "Any rating" },
  { value: "4", label: "4 stars & up" },
  { value: "3", label: "3 stars & up" },
];

function PriceRangeForm({
  minPrice = "",
  maxPrice = "",
  onApply,
  idPrefix,
}: {
  idPrefix: string;
  minPrice?: string;
  maxPrice?: string;
  onApply: (range: { minPrice?: string; maxPrice?: string }) => void;
}) {
  const [min, setMin] = useState(minPrice);
  const [max, setMax] = useState(maxPrice);
  const [error, setError] = useState<string>();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (min && max && new Big(min).gt(max)) {
      setError("Minimum price must not be higher than maximum price.");
      return;
    }
    setError(undefined);
    onApply({ minPrice: min || undefined, maxPrice: max || undefined });
  };
  const input =
    "w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-base tabular-nums";
  return (
    <form onSubmit={submit} noValidate aria-label="Price range">
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1 text-xs text-muted-foreground">
          Min (VND)
          <input
            inputMode="numeric"
            className={`mt-1 ${input}`}
            placeholder="0"
            value={min}
            aria-invalid={!!error}
            aria-describedby={error ? `${idPrefix}-price-error` : undefined}
            onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        <span aria-hidden="true" className="pb-2 text-muted-foreground">
          –
        </span>
        <label className="min-w-0 flex-1 text-xs text-muted-foreground">
          Max (VND)
          <input
            inputMode="numeric"
            className={`mt-1 ${input}`}
            placeholder="Any"
            value={max}
            aria-invalid={!!error}
            aria-describedby={error ? `${idPrefix}-price-error` : undefined}
            onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))}
          />
        </label>
      </div>
      {error && (
        <p
          id={`${idPrefix}-price-error`}
          role="alert"
          className="mt-2 text-xs text-destructive"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        className="mt-2 min-h-11 w-full rounded-md border border-border text-sm font-medium text-primary hover:bg-muted"
      >
        Apply price
      </button>
    </form>
  );
}

function RadioRow({
  name,
  value,
  checked,
  label,
  onSelect,
  indent = false,
}: {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  onSelect: (value: string) => void;
  indent?: boolean;
}) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded px-2 text-sm hover:bg-muted ${indent ? "pl-8" : ""} ${checked ? "font-medium" : ""}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="h-4 w-4 accent-[var(--primary)]"
      />
      {label}
    </label>
  );
}

export function FacetPanel({
  categories,
  value,
  onChange,
  onClear,
  idPrefix = "facet",
}: {
  idPrefix?: string;
  categories: Category[];
  value: Facets;
  onChange: (next: Facets) => void;
  onClear: () => void;
}) {
  const topLevel = categories.filter((c) => !c.parentId);
  const active = categories.find((c) => c.slug === value.category);
  const activeTop = active?.parentId
    ? categories.find((c) => c.id === active.parentId)
    : active;
  const children = activeTop
    ? categories.filter((c) => c.parentId === activeTop.id)
    : [];
  const setCategory = (slug: string) =>
    onChange({ ...value, category: slug || undefined });
  const count = activeFacetCount(value);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Filters</h2>
        {count > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="min-h-11 rounded px-2 text-sm text-primary hover:bg-muted"
          >
            Clear filters
          </button>
        )}
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Category</legend>
        <RadioRow
          name={`${idPrefix}-category`}
          value=""
          label="All categories"
          checked={!value.category}
          onSelect={setCategory}
        />
        {topLevel.map((category) => (
          <div key={category.id}>
            <RadioRow
              name={`${idPrefix}-category`}
              value={category.slug}
              label={category.name}
              checked={value.category === category.slug}
              onSelect={setCategory}
            />
            {activeTop?.id === category.id &&
              children.map((child) => (
                <RadioRow
                  key={child.id}
                  name={`${idPrefix}-category`}
                  value={child.slug}
                  label={child.name}
                  checked={value.category === child.slug}
                  onSelect={setCategory}
                  indent
                />
              ))}
          </div>
        ))}
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Price</legend>
        <PriceRangeForm
          key={`${value.minPrice ?? ""}-${value.maxPrice ?? ""}`}
          minPrice={value.minPrice}
          maxPrice={value.maxPrice}
          idPrefix={idPrefix}
          onApply={(range) => onChange({ ...value, ...range })}
        />
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Rating</legend>
        {RATINGS.map((rating) => (
          <RadioRow
            key={rating.value}
            name={`${idPrefix}-rating`}
            value={rating.value}
            label={rating.label}
            checked={(value.minRating ?? "") === rating.value}
            onSelect={(v) => onChange({ ...value, minRating: v || undefined })}
          />
        ))}
      </fieldset>
    </div>
  );
}
