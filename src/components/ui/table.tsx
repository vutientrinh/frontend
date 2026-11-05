import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-auto">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}
export function TableHeader(props: ComponentProps<"thead">) {
  return <thead {...props} />;
}
export function TableBody(props: ComponentProps<"tbody">) {
  return <tbody {...props} />;
}
export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("border-b border-border", className)} {...props} />;
}
export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th className={cn("p-3 text-left font-medium", className)} {...props} />
  );
}
export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("p-3", className)} {...props} />;
}
