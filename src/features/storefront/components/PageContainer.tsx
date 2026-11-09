import type { ReactNode } from "react";

/** Storefront page width (TASK-025 C3): centred, max 1200 px, instead of full bleed. */
export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1200px]">{children}</div>;
}
