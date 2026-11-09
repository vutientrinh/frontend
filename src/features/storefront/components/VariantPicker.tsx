import type { Variant } from "../../commerce/types";
import {
  isOptionValueAvailable,
  selectOptionValue,
  type ProductOption,
  type VariantSelection,
} from "../lib";

/**
 * One radio group per option. Values with no in-stock variant (given the options chosen
 * before it) are disabled; choosing a value drops later choices that become impossible.
 */
export function VariantPicker({
  options,
  variants,
  value,
  onChange,
  idPrefix = "variant",
}: {
  options: ProductOption[];
  variants: Variant[];
  value: VariantSelection;
  onChange: (next: VariantSelection) => void;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-4">
      {options.map((option) => (
        <fieldset key={option.name}>
          <legend className="mb-2 text-sm">
            <span className="text-muted-foreground">{option.name}:</span>{" "}
            <span className="font-medium">
              {value[option.name] ?? "Choose one"}
            </span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {option.values.map((optionValue) => {
              const available = isOptionValueAvailable(
                variants,
                options,
                value,
                option.name,
                optionValue,
              );
              const checked = value[option.name] === optionValue;
              const id = `${idPrefix}-${option.name}-${optionValue}`.replace(
                /\s+/g,
                "-",
              );
              return (
                <label
                  key={optionValue}
                  htmlFor={id}
                  className={`relative inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md border px-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                    checked
                      ? "border-primary bg-muted font-medium text-foreground"
                      : "border-border bg-card hover:bg-muted"
                  } ${available ? "" : "cursor-not-allowed text-muted-foreground line-through opacity-60"}`}
                >
                  <input
                    id={id}
                    type="radio"
                    className="sr-only"
                    name={`${idPrefix}-${option.name}`}
                    value={optionValue}
                    checked={checked}
                    disabled={!available}
                    aria-label={
                      available ? optionValue : `${optionValue}, sold out`
                    }
                    onChange={() =>
                      onChange(
                        selectOptionValue(
                          variants,
                          options,
                          value,
                          option.name,
                          optionValue,
                        ),
                      )
                    }
                  />
                  {optionValue}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
