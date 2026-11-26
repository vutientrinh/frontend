import { ImagePlus } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/layout/Page";
import { ConfirmDialog, ErrorState, FormField } from "../../components/shared";
import { TableSkeleton } from "../../components/TableSkeleton";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Switch } from "../../components/ui/switch";
import { useSaveSellerSettings, useSellerSettings } from "../commerce/api";
import type { SellerSettings } from "../commerce/types";
import { ErrorText } from "./common";
import { MAX_IMAGE_BYTES, readImage } from "./image-utils";
import { useUnsavedGuard } from "./useUnsavedGuard";

const DESCRIPTION_MAX = 1000;
type TextKey =
  "shopName" | "description" | "location" | "contactPhone" | "contactEmail";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="grid gap-4 p-5">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </Card>
  );
}

/** Logo / banner upload with preview; the value is a URL or data URL string. */
function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
}) {
  const [error, setError] = useState("");
  const name = label.toLowerCase();
  const pick = async (file: File) => {
    setError("");
    if (!file.type.startsWith("image/"))
      return setError("Choose an image file.");
    if (file.size > MAX_IMAGE_BYTES)
      return setError("The image must be 1 MB or smaller.");
    try {
      onChange(await readImage(file));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not read the image.",
      );
    }
  };
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          <img
            src={value}
            alt={`Current ${name}`}
            className="h-16 max-w-48 rounded-md border border-border object-cover"
          />
        ) : (
          <span className="grid size-16 place-items-center rounded-md bg-muted text-muted-foreground">
            <ImagePlus size={20} aria-hidden="true" />
          </span>
        )}
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
          {value ? `Replace ${name}` : `Upload ${name}`}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void pick(file);
              e.target.value = "";
            }}
          />
        </label>
        {value && (
          <Button
            variant="ghost"
            className="min-h-11"
            aria-label={`Remove ${name}`}
            onClick={() => onChange("")}
          >
            Remove
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Up to 1 MB.</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function SettingsForm({ initial }: { initial: SellerSettings }) {
  const navigate = useNavigate();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [leaving, setLeaving] = useState<string>();
  const save = useSaveSellerSettings();
  const dirty = JSON.stringify(value) !== saved;
  useUnsavedGuard(dirty && !save.isPending, setLeaving);
  const update = (key: keyof SellerSettings, v: string) =>
    setValue((prev) => ({ ...prev, [key]: v }));
  const textField = (key: TextKey, label: string, type = "text") => (
    <FormField id={`settings-${key}`} label={label} required>
      <Input
        type={type}
        required
        className="min-h-11"
        value={value[key] ?? ""}
        onChange={(e) => update(key, e.target.value)}
      />
    </FormField>
  );
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    save.mutate(value, {
      onSuccess: () => setSaved(JSON.stringify(value)),
    });
  };
  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <Section title="Profile">
        {textField("shopName", "Shop name")}
        <FormField
          id="settings-description"
          label="Description"
          required
          counter={{
            value: (value.description ?? "").length,
            max: DESCRIPTION_MAX,
          }}
        >
          <textarea
            required
            maxLength={DESCRIPTION_MAX}
            value={value.description ?? ""}
            onChange={(e) => update("description", e.target.value)}
            className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </FormField>
        {textField("location", "Location")}
      </Section>
      <Section title="Contact">
        {textField("contactPhone", "Contact phone", "tel")}
        {textField("contactEmail", "Contact email", "email")}
      </Section>
      <Section title="Branding">
        <ImageField
          label="Logo"
          value={value.logoUrl}
          onChange={(v) => update("logoUrl", v)}
        />
        <ImageField
          label="Banner"
          value={value.bannerUrl}
          onChange={(v) => update("bannerUrl", v)}
        />
      </Section>
      <Section title="Notifications">
        {(
          [
            ["newOrder", "New orders"],
            ["lowStock", "Low stock"],
            ["payout", "Payouts"],
          ] as const
        ).map(([key, label]) => (
          <div
            key={key}
            className="flex min-h-11 items-center justify-between gap-3 text-sm"
          >
            <span id={`notify-${key}`}>{label}</span>
            <Switch
              // 24 px track + 10 px on each side = a 44 px target
              className="before:-inset-2.5"
              aria-labelledby={`notify-${key}`}
              checked={value.notifications[key]}
              onCheckedChange={(checked) =>
                setValue((prev) => ({
                  ...prev,
                  notifications: { ...prev.notifications, [key]: checked },
                }))
              }
            />
          </div>
        ))}
      </Section>
      <ErrorText error={save.error} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground" role="status">
          {dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <Button type="submit" className="min-h-11" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>
      <ConfirmDialog
        open={leaving !== undefined}
        onOpenChange={(open) => {
          if (!open) setLeaving(undefined);
        }}
        title="Discard unsaved changes?"
        description="Your shop settings have changes that are not saved."
        confirmLabel="Leave without saving"
        destructive
        onConfirm={() => {
          if (leaving !== undefined) navigate(leaving);
        }}
      />
    </form>
  );
}

export function Settings() {
  const q = useSellerSettings();
  return (
    <>
      <PageHeader
        title="Shop settings"
        description="What shoppers see about your shop, and what we notify you about."
      />
      {q.isError ? (
        <ErrorState retry={() => void q.refetch()} />
      ) : !q.data ? (
        <TableSkeleton rows={6} columns={1} label="Loading shop settings" />
      ) : (
        <SettingsForm initial={q.data} />
      )}
    </>
  );
}
