import { ConfirmDialog } from "../../components/shared";

/** Reject needs a reason; the order is cancelled and the buyer refunded. */
export function RejectOrderDialog({
  order,
  onClose,
  onReject,
}: {
  order: { id: string; orderNumber: string } | undefined;
  onClose: () => void;
  onReject: (id: string, reason: string) => void;
}) {
  return (
    <ConfirmDialog
      open={!!order}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Reject ${order?.orderNumber ?? "order"}?`}
      description="The order will be cancelled and refunded. This cannot be undone."
      confirmLabel="Reject order"
      destructive
      reason={{ label: "Rejection reason", required: true }}
      onConfirm={(reason) => {
        if (order && reason) onReject(order.id, reason);
      }}
    />
  );
}
