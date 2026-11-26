import {
  Ban,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Clock,
  CreditCard,
  EyeOff,
  Package,
  PackageCheck,
  RotateCcw,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { humanLabel } from "../lib/labels";

export type StatusTone =
  "success" | "warning" | "danger" | "info" | "refunded" | "neutral";

export interface StatusPresentation {
  tone: StatusTone;
  icon: LucideIcon;
  label: string;
}

export const statusStyles: Record<StatusTone, string> = {
  success: "text-status-completed",
  warning: "text-status-pending",
  danger: "text-status-failed",
  info: "text-status-processing",
  refunded: "text-status-refunded",
  neutral: "text-muted-foreground",
};

const statusMap: Record<string, { tone: StatusTone; icon: LucideIcon }> = {
  COMPLETED: { tone: "success", icon: CircleCheck },
  LIVE: { tone: "success", icon: CircleCheck },
  APPROVED: { tone: "success", icon: CircleCheck },
  PAID: { tone: "success", icon: CreditCard },
  PUBLISHED: { tone: "success", icon: CircleCheck },
  CONFIRMED: { tone: "success", icon: CircleCheck },
  PACKED: { tone: "success", icon: PackageCheck },
  DELIVERED: { tone: "success", icon: PackageCheck },
  SUCCEEDED: { tone: "success", icon: CircleCheck },
  PENDING: { tone: "warning", icon: Clock },
  PENDING_PAYMENT: { tone: "warning", icon: Clock },
  CREATED: { tone: "warning", icon: Clock },
  REQUIRES_ACTION: { tone: "warning", icon: CircleAlert },
  RETURN_REQUESTED: { tone: "warning", icon: RotateCcw },
  UNDER_REVIEW: { tone: "warning", icon: Clock },
  PENDING_REVIEW: { tone: "warning", icon: Clock },
  EXPIRED: { tone: "warning", icon: Clock },
  FAILED: { tone: "danger", icon: CircleAlert },
  PAYMENT_FAILED: { tone: "danger", icon: CircleAlert },
  DELIVERY_FAILED: { tone: "danger", icon: CircleAlert },
  DECLINED: { tone: "danger", icon: CircleAlert },
  REJECTED: { tone: "danger", icon: CircleAlert },
  DRAFT: { tone: "neutral", icon: CircleDashed },
  HIDDEN: { tone: "neutral", icon: EyeOff },
  PROCESSING: { tone: "info", icon: Clock },
  SHIPPED: { tone: "info", icon: Truck },
  IN_TRANSIT: { tone: "info", icon: Truck },
  OUT_FOR_DELIVERY: { tone: "info", icon: Truck },
  LABEL_CREATED: { tone: "info", icon: Package },
  REFUNDED: { tone: "refunded", icon: RotateCcw },
  RETURNED: { tone: "neutral", icon: RotateCcw },
  CANCELLED: { tone: "neutral", icon: Ban },
};

export function getStatusPresentation(status: string): StatusPresentation {
  const normalized = status.trim().toUpperCase();
  const presentation =
    statusMap[normalized] ??
    (normalized.includes("FAIL")
      ? { tone: "danger" as const, icon: CircleAlert }
      : normalized.includes("PROCESS")
        ? { tone: "info" as const, icon: Clock }
        : { tone: "neutral" as const, icon: CircleDashed });
  return { ...presentation, label: humanLabel(normalized) };
}
