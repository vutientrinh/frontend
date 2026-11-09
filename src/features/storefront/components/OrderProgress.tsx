import {
  Check,
  CircleAlert,
  RotateCcw,
  X,
  type LucideIcon,
} from "lucide-react";
import type { OrderDetail, SellerOrderStatus } from "../../commerce/types";
import { formatOrderDateTime, progressSteps, type ProgressStep } from "../lib";

const BRANCH_ICON: Partial<Record<SellerOrderStatus, LucideIcon>> = {
  CANCELLED: X,
  DELIVERY_FAILED: CircleAlert,
  RETURN_REQUESTED: RotateCcw,
  RETURNED: RotateCcw,
  REFUNDED: RotateCcw,
};

const DOT: Record<ProgressStep["state"], string> = {
  done: "border-primary bg-primary text-primary-foreground",
  current: "border-primary bg-background text-primary",
  todo: "border-border bg-background text-muted-foreground",
  branch: "border-destructive bg-destructive text-primary-foreground",
};

const STATE_TEXT: Record<ProgressStep["state"], string> = {
  done: "done",
  current: "current step",
  todo: "not yet",
  branch: "order stopped here",
};

/**
 * Progress overview (W-20, S-10). Horizontal from `sm`, vertical on phones so labels and
 * times never squeeze. State is text + shape, not color alone.
 */
export function OrderProgress({
  status,
  timeline,
}: {
  status: SellerOrderStatus;
  timeline: OrderDetail["timeline"];
}) {
  const steps = progressSteps(status, timeline);
  const BranchIcon = BRANCH_ICON[status];
  return (
    <ol
      aria-label="Order progress"
      className="flex flex-col gap-3 sm:flex-row sm:gap-0"
    >
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li
            key={step.label}
            aria-current={step.state === "current" ? "step" : undefined}
            className="relative flex items-center gap-3 sm:flex-1 sm:flex-col sm:items-center sm:gap-2 sm:text-center"
          >
            {!last && (
              <span
                aria-hidden="true"
                className={`absolute left-[13px] top-7 h-[calc(100%-4px)] w-0.5 sm:left-[calc(50%+14px)] sm:top-[13px] sm:h-0.5 sm:w-[calc(100%-28px)] ${steps[i + 1].state === "done" || steps[i + 1].state === "branch" || steps[i + 1].state === "current" ? "bg-primary" : "bg-border"}`}
              />
            )}
            <span
              aria-hidden="true"
              className={`relative z-[1] grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold ${DOT[step.state]}`}
            >
              {step.state === "done" ? (
                <Check size={14} />
              ) : step.state === "branch" && BranchIcon ? (
                <BranchIcon size={14} />
              ) : (
                i + 1
              )}
            </span>
            <span className="min-w-0 text-sm sm:px-1">
              <span
                className={`block ${step.state === "todo" ? "text-muted-foreground" : "font-medium"}`}
              >
                {step.label}
                <span className="sr-only">, {STATE_TEXT[step.state]}</span>
              </span>
              {step.at && (
                <time
                  dateTime={step.at}
                  className="block text-xs text-muted-foreground tabular-nums"
                >
                  {formatOrderDateTime(step.at)}
                </time>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
