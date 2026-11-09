import { useEffect, useState } from "react";

/** QR code rendered with the existing lazy-loaded `qrcode` dependency. */
export function QrImage({
  payload,
  label,
}: {
  payload: string;
  label: string;
}) {
  const [result, setResult] = useState<{ payload: string; svg: string }>();
  const [failed, setFailed] = useState<string>();
  useEffect(() => {
    let active = true;
    void import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toString(payload, {
          type: "svg",
          errorCorrectionLevel: "M",
          // The quiet zone and white modules background come from the qrcode SVG itself, so the
          // code stays scannable in dark mode without a hard-coded colour here.
          margin: 4,
          width: 240,
        }),
      )
      .then((svg) => {
        if (active) setResult({ payload, svg });
      })
      .catch(() => {
        if (active) setFailed(payload);
      });
    return () => {
      active = false;
    };
  }, [payload]);
  if (result?.payload === payload)
    return (
      <img
        className="h-60 w-60 rounded-md border border-border"
        src={`data:image/svg+xml,${encodeURIComponent(result.svg)}`}
        alt={label}
        width={240}
        height={240}
      />
    );
  if (failed === payload)
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not draw the QR code. Transfer using the reference below.
      </p>
    );
  return (
    <div
      role="status"
      className="grid h-60 w-60 place-items-center rounded-md border border-border bg-muted text-sm text-muted-foreground"
    >
      Creating QR code…
    </div>
  );
}
