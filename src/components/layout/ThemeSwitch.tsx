import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { applyTheme, getTheme, type Theme } from "../../app/theme";

const options: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export function ThemeSwitch({
  className = "",
  variant = "popover",
}: {
  className?: string;
  variant?: "popover" | "inline";
}) {
  const [theme, setTheme] = useState<Theme>(getTheme);

  useEffect(() => {
    const refresh = () => setTheme(getTheme());
    window.addEventListener("payment-theme-change", refresh);
    return () => window.removeEventListener("payment-theme-change", refresh);
  }, []);

  if (variant === "inline")
    return (
      <div
        role="radiogroup"
        aria-label="Theme"
        className={`flex gap-1 ${className}`.trim()}
      >
        {options.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            aria-label={label}
            onClick={() => {
              setTheme(value);
              applyTheme(value);
            }}
            className="grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-muted aria-checked:bg-muted aria-checked:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Icon size={18} aria-hidden="true" />
          </button>
        ))}
      </div>
    );

  return (
    <details className={`relative ${className}`.trim()}>
      <summary
        aria-label={`Theme: ${theme}. Change theme`}
        className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-md hover:bg-muted [&::-webkit-details-marker]:hidden"
      >
        <span aria-hidden="true" className="relative size-[18px]">
          {options.map(({ value, Icon }) => (
            <Icon
              key={value}
              size={18}
              className={`absolute inset-0 transition-opacity duration-[120ms] motion-reduce:transition-none ${theme === value ? "opacity-100" : "opacity-0"}`}
            />
          ))}
        </span>
      </summary>
      <div
        aria-label="Theme"
        className="absolute right-0 z-30 mt-2 min-w-36 rounded-md border border-border bg-popover p-1 shadow-lg"
      >
        {options.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={theme === value}
            onClick={(event) => {
              setTheme(value);
              applyTheme(value);
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
            className="flex min-h-11 w-full items-center gap-3 rounded px-3 text-left text-sm hover:bg-muted aria-pressed:bg-muted"
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </details>
  );
}
