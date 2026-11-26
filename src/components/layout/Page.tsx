import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link, type To } from "react-router-dom";

export type PageWidth = "full" | "wide" | "content" | "narrow";

const widths: Record<PageWidth, string> = {
  full: "page-width-full",
  wide: "page-width-wide",
  content: "page-width-content",
  narrow: "page-width-narrow",
};

export function Page({
  width = "wide",
  children,
  className = "",
}: {
  width?: PageWidth;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`page-container ${widths[width]} ${className}`.trim()}
      style={
        { "--page-gutter": "clamp(16px, 4vw, 48px)" } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  action,
  breadcrumb,
  back,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  action?: ReactNode;
  /** Trail above the title; items without `to` are the current page. */
  breadcrumb?: { label: string; to?: To }[];
  /** Single back link (mobile-friendly alternative to a trail). */
  back?: { label: string; to: To };
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
              {breadcrumb.map((item, i) => (
                <li
                  key={`${i}-${item.label}`}
                  className="flex items-center gap-1"
                >
                  {i > 0 && <ChevronRight size={14} aria-hidden="true" />}
                  {item.to !== undefined ? (
                    <Link
                      to={item.to}
                      className="inline-flex min-h-11 items-center underline-offset-4 hover:text-foreground hover:underline sm:min-h-0"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span aria-current="page">{item.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        {back && (
          <Link
            to={back.to}
            className="mb-1 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            {back.label}
          </Link>
        )}
        {/* Same token as the storefront h1 (features/storefront/type.ts) */}
        <h1 className="text-h1 font-bold tracking-[-0.015em]">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions ?? action}
    </header>
  );
}
