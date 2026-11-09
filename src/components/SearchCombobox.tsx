import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, ChevronsUpDown } from "lucide-react";
export function SearchCombobox({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          className="mt-1 flex w-full items-center justify-between gap-2 rounded border border-border bg-background p-2 text-left text-sm"
        >
          <span className="truncate">
            {selected?.label ??
              (value
                ? "Unavailable selection"
                : `Select ${label.toLowerCase()}`)}
          </span>
          <ChevronsUpDown size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[min(90vw,400px)] rounded-md border border-border bg-card p-2 shadow-lg"
        >
          <Command label={`Search ${label}`}>
            <Command.Input
              autoFocus
              placeholder={`Search ${label.toLowerCase()}`}
              className="w-full rounded border border-border bg-background p-2 text-sm"
            />
            <Command.List className="max-h-60 overflow-auto py-1">
              <Command.Empty className="p-3 text-sm text-muted-foreground">
                No results found.
              </Command.Empty>
              {options.map((option) => (
                <Command.Item
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded p-2 text-sm data-[selected=true]:bg-muted"
                >
                  <Check
                    size={15}
                    className={
                      value === option.value ? "opacity-100" : "opacity-0"
                    }
                  />
                  {option.label}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
