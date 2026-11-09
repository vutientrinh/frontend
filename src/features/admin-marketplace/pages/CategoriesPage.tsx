import { useState, type FormEvent } from "react";
import { ChevronRight, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState, PageHeader } from "../../../components/shared";
import {
  useAdminCategories,
  useCreateCategory,
  useUpdateCategory,
} from "../api";
import { normalizeRate, rateError } from "../lib";
import type { AdminCategory } from "../types";

type Mode =
  | { kind: "edit"; category: AdminCategory }
  | { kind: "add"; parent: AdminCategory | null };

function CategoryForm({ mode, onDone }: { mode: Mode; onDone: () => void }) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const editing = mode.kind === "edit" ? mode.category : undefined;
  const [name, setName] = useState(editing?.name ?? "");
  const [rate, setRate] = useState(
    editing?.commissionRatePercent ??
      (mode.kind === "add" ? mode.parent?.commissionRatePercent : undefined) ??
      "5.0",
  );
  const [errors, setErrors] = useState<{
    name?: string;
    rate?: string;
    form?: string;
  }>({});
  const pending = create.isPending || update.isPending;
  const idBase = editing ? `cat-${editing.id}` : "cat-new";

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = {
      name: name.trim() ? undefined : "Enter a category name.",
      rate: rateError(rate),
    };
    setErrors(next);
    if (next.name || next.rate) return;
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          name: name.trim(),
          commissionRatePercent: normalizeRate(rate),
        });
        toast.success(`Saved ${name.trim()}`);
      } else {
        await create.mutateAsync({
          name: name.trim(),
          parentId: mode.kind === "add" ? (mode.parent?.id ?? null) : null,
          commissionRatePercent: normalizeRate(rate),
        });
        toast.success(`Added ${name.trim()}`);
      }
      onDone();
    } catch (err) {
      setErrors({
        form: err instanceof Error ? err.message : "Could not save.",
      });
    }
  }

  const title = editing
    ? `Edit ${editing.name}`
    : mode.kind === "add" && mode.parent
      ? `New sub-category of ${mode.parent.name}`
      : "New top-level category";
  return (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      aria-label={title}
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <h3 className="font-medium">{title}</h3>
      <div className="flex flex-wrap gap-3">
        <label htmlFor={`${idBase}-name`} className="min-w-48 flex-1 text-sm">
          Name
          <input
            id={`${idBase}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? `${idBase}-name-error` : undefined}
            className="mt-1 min-h-10 w-full rounded-md border border-input bg-background px-3"
          />
        </label>
        <label htmlFor={`${idBase}-rate`} className="w-36 text-sm">
          Commission (%)
          <input
            id={`${idBase}-rate`}
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))}
            aria-invalid={!!errors.rate}
            aria-describedby={errors.rate ? `${idBase}-rate-error` : undefined}
            className="mt-1 min-h-10 w-full rounded-md border border-input bg-background px-3 tabular-nums"
          />
        </label>
      </div>
      {errors.name && (
        <p
          id={`${idBase}-name-error`}
          role="alert"
          className="text-sm text-destructive"
        >
          {errors.name}
        </p>
      )}
      {errors.rate && (
        <p
          id={`${idBase}-rate-error`}
          role="alert"
          className="text-sm text-destructive"
        >
          {errors.rate}
        </p>
      )}
      {errors.form && (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : editing ? "Save category" : "Add category"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-10 rounded-md border border-input px-4 text-sm font-medium hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function CategoryNode({
  category,
  depth,
  mode,
  setMode,
}: {
  category: AdminCategory;
  depth: number;
  mode?: Mode;
  setMode: (mode?: Mode) => void;
}) {
  const editing = mode?.kind === "edit" && mode.category.id === category.id;
  const adding = mode?.kind === "add" && mode.parent?.id === category.id;
  return (
    <li>
      {editing ? (
        <div className="py-2">
          <CategoryForm mode={mode} onDone={() => setMode(undefined)} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 border-b border-border py-2">
          {depth > 0 && (
            <ChevronRight
              size={14}
              aria-hidden="true"
              className="text-muted-foreground"
            />
          )}
          <span className="min-w-40 flex-1">
            <span className="font-medium">{category.name}</span>{" "}
            <code className="font-mono text-xs text-muted-foreground">
              {category.slug}
            </code>
          </span>
          <span className="w-24 text-right text-sm tabular-nums text-muted-foreground">
            {category.productCount} products
          </span>
          <span className="w-28 text-right text-sm tabular-nums">
            {category.commissionRatePercent}% commission
          </span>
          <button
            type="button"
            onClick={() => setMode({ kind: "edit", category })}
            aria-label={`Edit ${category.name}`}
            className="inline-flex min-h-9 items-center gap-1 rounded-sm px-2 text-sm text-primary hover:bg-muted"
          >
            <Pencil size={14} aria-hidden="true" /> Edit
          </button>
          {depth === 0 && (
            <button
              type="button"
              onClick={() => setMode({ kind: "add", parent: category })}
              aria-label={`Add sub-category to ${category.name}`}
              className="inline-flex min-h-9 items-center gap-1 rounded-sm px-2 text-sm text-primary hover:bg-muted"
            >
              <Plus size={14} aria-hidden="true" /> Add child
            </button>
          )}
        </div>
      )}
      {(category.children.length > 0 || adding) && (
        <ul className="ml-6" aria-label={`${category.name} sub-categories`}>
          {category.children.map((child) => (
            <CategoryNode
              key={child.id}
              category={child}
              depth={depth + 1}
              mode={mode}
              setMode={setMode}
            />
          ))}
          {adding && (
            <li className="py-2">
              <CategoryForm mode={mode} onDone={() => setMode(undefined)} />
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

/** A-12 Category tree: add top-level or child, rename, commission %. Two levels. */
export default function CategoriesPage() {
  const tree = useAdminCategories();
  const [mode, setMode] = useState<Mode>();
  const addingTop = mode?.kind === "add" && mode.parent === null;
  return (
    <>
      <PageHeader
        title="Categories"
        description="Two-level category tree. Commission applies to products in the category unless the seller has its own rate."
        action={
          <button
            type="button"
            onClick={() => setMode({ kind: "add", parent: null })}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus size={16} aria-hidden="true" /> New category
          </button>
        }
      />
      <section className="border-t border-border pt-4">
        {addingTop && (
          <div className="mb-4">
            <CategoryForm mode={mode} onDone={() => setMode(undefined)} />
          </div>
        )}
        {tree.isError ? (
          <ErrorState retry={() => void tree.refetch()} />
        ) : tree.isLoading || !tree.data ? (
          <div role="status" className="space-y-2">
            <span className="sr-only">Loading categories</span>
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="h-10 rounded bg-muted motion-safe:animate-pulse"
              />
            ))}
          </div>
        ) : tree.data.length === 0 ? (
          <EmptyState
            title="No categories yet"
            description="Add the first top-level category to start the catalog."
          />
        ) : (
          <ul aria-label="Category tree">
            {tree.data.map((category) => (
              <CategoryNode
                key={category.id}
                category={category}
                depth={0}
                mode={mode}
                setMode={setMode}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
