import { CircleCheck, Package, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { brand } from "../../config/brand";
import { Page } from "../layout/Page";
import { ThemeSwitch } from "../layout/ThemeSwitch";
import { MoneyText } from "../shared";
import { Logo } from "./Logo";

export type AuthAudience = "shopper" | "seller" | "staff";

const copy: Record<
  AuthAudience,
  { home: string; headline: string; body: string }
> = {
  shopper: {
    home: "/",
    headline: brand.tagline,
    body: "Buy from many sellers with one wallet. Your money is held safely until the order arrives.",
  },
  seller: {
    home: "/seller/login",
    headline: `Sell on ${brand.name}`,
    body: "Reach more shoppers. Payment is held in escrow and released to you on delivery.",
  },
  staff: {
    home: "/admin/login",
    headline: `${brand.name} back office`,
    body: "Orders, wallets, payouts and the ledger in one place.",
  },
};

const fragment =
  "absolute w-64 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-[var(--elevation-2)]";

/** Three UI fragments floating on the gradient: a balance, a receipt, a parcel. Decorative. */
function Fragments() {
  return (
    <div
      aria-hidden="true"
      className="relative h-[264px] w-full max-w-[420px] [@media(max-height:720px)]:hidden"
    >
      <div className={`${fragment} left-0 top-0 -rotate-3`}>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <WalletCards size={16} className="text-primary" /> Wallet balance
        </p>
        <p className="mt-2 text-2xl font-semibold">
          <MoneyText amount="12480000" />
        </p>
      </div>
      <div className={`${fragment} right-0 top-[92px] rotate-2`}>
        <p className="flex items-center gap-2 text-sm font-medium">
          <CircleCheck size={16} className="text-success" /> Payment received
        </p>
        <div className="mt-3 flex items-baseline justify-between gap-3 text-sm">
          <span className="whitespace-nowrap text-muted-foreground">
            Order 2611-0042
          </span>
          <MoneyText amount="250000" sign="plus" tone="success" />
        </div>
      </div>
      <div className={`${fragment} bottom-0 left-8 -rotate-1`}>
        <p className="flex items-center gap-2 text-sm font-medium">
          <Package size={16} className="text-primary" /> Out for delivery
        </p>
        <div className="mt-3 grid grid-cols-3 gap-1">
          <span className="h-1.5 rounded-full bg-primary" />
          <span className="h-1.5 rounded-full bg-primary" />
          <span className="h-1.5 rounded-full bg-muted" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Arrives tomorrow</p>
      </div>
    </div>
  );
}

/**
 * Auth split screen (TASK-029 A4, plan §5.3): brand panel (gradient + floating UI fragments) on the
 * start side, the form on the end side. Under 1024 px the panel becomes a slim header bar.
 */
export function AuthSplitLayout({
  audience = "shopper",
  children,
}: {
  audience?: AuthAudience;
  children: ReactNode;
}) {
  const c = copy[audience];
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside
        aria-label={brand.name}
        className="bg-[image:var(--brand-gradient)] text-primary-foreground lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden"
      >
        <div className="flex items-center justify-between gap-4 px-[clamp(16px,4vw,48px)] py-3 lg:grid lg:h-full lg:grid-cols-[minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:justify-normal lg:items-start lg:py-10">
          <Link
            to={c.home}
            className="rounded-md focus-visible:outline-primary-foreground"
          >
            <Logo inverted />
          </Link>
          <p className="hidden text-sm sm:block lg:hidden">{c.headline}</p>
          <div className="hidden w-full space-y-10 lg:block lg:self-center">
            <div className="max-w-[24ch] space-y-3">
              <p className="text-h1 font-bold tracking-[-0.015em]">
                {c.headline}
              </p>
              <p className="text-base">{c.body}</p>
            </div>
            <Fragments />
          </div>
        </div>
      </aside>
      <main
        id="auth-main"
        className="relative py-8 sm:py-12 lg:flex lg:min-h-screen lg:items-center lg:py-16"
      >
        <div className="absolute right-[clamp(16px,4vw,48px)] top-2 z-10">
          <ThemeSwitch />
        </div>
        <Page width="narrow">{children}</Page>
      </main>
    </div>
  );
}
