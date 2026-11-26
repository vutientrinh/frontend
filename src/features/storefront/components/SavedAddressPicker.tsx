import { Plus } from "lucide-react";
import { Illustration } from "../../../components/brand/Illustration";
import type { Address } from "../../banking/types";

/** Choose a delivery address from `/me/addresses`. Empty state offers adding one. */
export function SavedAddressPicker({
  addresses,
  value,
  onChange,
  onAddNew,
  hideLegend,
}: {
  addresses: Address[];
  value?: string;
  onChange: (addressId: string) => void;
  onAddNew?: () => void;
  /** The legend stays for screen readers when a visible step heading already names it. */
  hideLegend?: boolean;
}) {
  const addButton = onAddNew && (
    <button
      type="button"
      onClick={onAddNew}
      className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-primary hover:bg-muted"
    >
      <Plus size={16} aria-hidden="true" />
      Add address
    </button>
  );
  if (!addresses.length)
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-border p-4 text-center">
        <Illustration name="empty-addresses" size="sm" />
        <p className="mt-3 text-sm">
          No saved addresses yet. Add one to see shipping options.
        </p>
        {addButton && <div className="mt-2">{addButton}</div>}
      </div>
    );
  return (
    <fieldset>
      <legend className={hideLegend ? "sr-only" : "mb-2 font-semibold"}>
        Delivery address
      </legend>
      <div className="space-y-2">
        {addresses.map((address) => {
          const checked = value === address.id;
          return (
            <label
              key={address.id}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${checked ? "border-primary bg-[color-mix(in_oklch,var(--primary)_10%,transparent)]" : "border-border bg-card hover:bg-muted"}`}
            >
              <input
                type="radio"
                name="delivery-address"
                value={address.id}
                checked={checked}
                onChange={() => onChange(address.id)}
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
              />
              <span className="min-w-0 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{address.recipient}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {address.phone}
                  </span>
                  {address.isDefault && (
                    <span className="rounded border border-border px-1.5 text-xs text-muted-foreground">
                      Default
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-muted-foreground">
                  {address.address}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {addButton && <div className="mt-2">{addButton}</div>}
    </fieldset>
  );
}
