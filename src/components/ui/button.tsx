import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";
export function Button({
  className,
  asChild = false,
  type,
  variant = "primary",
  size = "default",
  ...props
}: ComponentProps<"button"> & {
  asChild?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "default" | "sm";
}) {
  const Comp = asChild ? Slot : "button";
  const variants = {
    primary: "bg-primary text-primary-foreground hover:brightness-95",
    secondary:
      "border border-input bg-transparent text-foreground hover:bg-muted",
    ghost: "bg-transparent text-foreground hover:bg-muted",
    destructive: "bg-destructive text-background hover:brightness-95",
  };
  return (
    <Comp
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        size === "sm" && "min-h-8 px-3 text-xs",
        className,
      )}
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    />
  );
}
