import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { ConfirmDialog, ErrorState, Money } from "../../components/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../../components/ui/dialog";
import { request } from "./client";
import { useAuth } from "./AuthContext";
import { PasswordStrength } from "./OtpChallenge";
import type { Address, User, Wallet } from "./types";

type AccountSection = "profile" | "addresses" | "security" | "verification";
type AddressInput = {
  recipient: string;
  phone: string;
  address: string;
  isDefault: boolean;
};
type AddressMutation = {
  id?: string;
  method: "POST" | "PUT" | "DELETE";
  body: Partial<AddressInput>;
};
const accountSections: { id: AccountSection; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "addresses", label: "Addresses" },
  { id: "security", label: "Security" },
  { id: "verification", label: "Verification" },
];
function fullAddress(value: string) {
  const [street = "", ward = "", district = "", ...province] = value
    .split(",")
    .map((part) => part.trim());
  return {
    street: value.includes(",") ? street : value,
    ward,
    district,
    province: province.join(", "),
  };
}
function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

export default function Account({ verify = false }: { verify?: boolean }) {
  const { user, setUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<AccountSection>("profile");
  const [profileName, setProfileName] = useState(user?.fullName ?? "");
  const [profileEmail, setProfileEmail] = useState(user?.email ?? "");
  const [editing, setEditing] = useState<Address | null>(null);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Address | null>(null);
  const [profileError, setProfileError] = useState("");
  const [addressError, setAddressError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const addresses = useQuery({
    queryKey: ["me", "addresses"],
    queryFn: () => request<Address[]>("/me/addresses"),
    enabled: !verify,
  });
  const wallet = useQuery({
    queryKey: ["wallet", "me"],
    queryFn: () => request<Wallet>("/wallets/me"),
    enabled: !verify && (user?.kycTier ?? 0) > 0,
  });
  const profileMutation = useMutation({
    mutationFn: (body: { fullName: string; email: string }) =>
      request<User>("/me/profile", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: (updated) => {
      setUser(updated);
      setProfileError("");
      toast.success("Profile saved.");
    },
    onError: (error) => setProfileError(error.message),
    meta: { suppressSuccessToast: true },
  });
  const addressMutation = useMutation({
    mutationFn: ({ id, method, body }: AddressMutation) =>
      request<Address | undefined>(
        id ? `/me/addresses/${id}` : "/me/addresses",
        {
          method,
          body: method === "DELETE" ? undefined : JSON.stringify(body),
        },
      ),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["me", "addresses"] });
      setAddressDialogOpen(false);
      setEditing(null);
      setAddressError("");
      toast.success(
        variables.method === "DELETE"
          ? "Address deleted."
          : variables.body.isDefault
            ? "Default address saved."
            : "Address saved.",
      );
    },
    onError: (error) => setAddressError(error.message),
    meta: { suppressSuccessToast: true },
  });
  const passwordMutation = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      request<void>("/me/password", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError("");
      toast.success("Password updated.");
    },
    onError: (error) => setPasswordError(error.message),
    meta: { suppressSuccessToast: true },
  });
  const verificationMutation = useMutation({
    mutationFn: (body: {
      fullName: string;
      dateOfBirth: string;
      idNumber: string;
    }) =>
      request<User>("/me/kyc/tier1", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (updated) => {
      setUser(updated);
      toast.success("Identity verified.");
    },
    meta: { suppressSuccessToast: true },
  });

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError("");
    profileMutation.mutate({
      fullName: profileName.trim(),
      email: profileEmail.trim(),
    });
  }
  function submitAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const address = ["street", "ward", "district", "province"]
      .map((field) => String(form.get(field) ?? "").trim())
      .filter(Boolean)
      .join(", ");
    const body: AddressInput = {
      recipient: String(form.get("recipient") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      address,
      isDefault: form.get("isDefault") === "on",
    };
    setAddressError("");
    addressMutation.mutate({
      id: editing?.id,
      method: editing ? "PUT" : "POST",
      body,
    });
  }
  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    if (newPassword.length < 8) {
      setPasswordError("Use at least 8 characters for your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    passwordMutation.mutate({ currentPassword, newPassword });
  }
  function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    verificationMutation.mutate({
      fullName: String(form.get("fullName") ?? "").trim(),
      dateOfBirth: String(form.get("dateOfBirth") ?? ""),
      idNumber: String(form.get("idNumber") ?? "").trim(),
    });
  }

  if (verify) {
    return (
      <section className="mx-auto max-w-2xl space-y-5">
        <header>
          <p className="text-sm font-medium text-primary">
            Account � Verification
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Verify identity</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tier 1 verification opens your wallet and raises your account
            limits.
          </p>
        </header>
        {user?.kycTier ? (
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold">Tier 1 verified</h2>
            <Link
              className="mt-3 inline-block text-primary underline"
              to="/wallet"
            >
              View wallet
            </Link>
          </div>
        ) : (
          <form
            onSubmit={submitVerification}
            className="space-y-4 rounded-xl border border-border bg-card p-5"
          >
            {[
              ["fullName", "Full name", "text"],
              ["dateOfBirth", "Date of birth", "date"],
              ["idNumber", "ID number", "text"],
            ].map(([name, label, type]) => (
              <label key={name} className="block text-sm font-medium">
                {label}{" "}
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
                <input
                  required
                  type={type}
                  name={name}
                  defaultValue={
                    name === "fullName" ? user?.fullName : undefined
                  }
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3"
                />
              </label>
            ))}
            <Button type="submit" disabled={verificationMutation.isPending}>
              {verificationMutation.isPending
                ? "Submitting�"
                : "Verify identity"}
            </Button>
            {verificationMutation.error && (
              <p role="alert" className="text-sm text-destructive">
                {verificationMutation.error.message}
              </p>
            )}
          </form>
        )}
      </section>
    );
  }

  const phone = user?.phone ?? "";
  const isProfileDirty =
    profileName !== (user?.fullName ?? "") ||
    profileEmail !== (user?.email ?? "");
  const editingAddress = editing ? fullAddress(editing.address) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5 sm:p-7">
        <div
          aria-hidden="true"
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary/10 text-xl font-semibold text-primary"
        >
          {initials(user?.fullName ?? "")}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Shopper account</p>
          <h1 className="truncate text-2xl font-semibold">
            {user?.fullName || "Your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{phone}</p>
        </div>
        <span className="rounded-full border border-border bg-muted px-3 py-1 text-sm font-medium">
          Tier {user?.kycTier ?? 0}
        </span>
        {(user?.kycTier ?? 0) < 1 && (
          <Link
            to="/me/verify"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground sm:w-auto"
          >
            Verify to raise limits
          </Link>
        )}
      </header>

      <nav
        aria-label="Account sections"
        className="overflow-x-auto border-b border-border"
      >
        <div
          className="flex min-w-max gap-2"
          role="group"
          aria-label="Account sections"
        >
          {accountSections.map((section) => (
            <button
              key={section.id}
              type="button"
              aria-pressed={activeSection === section.id}
              onClick={() => setActiveSection(section.id)}
              className={`min-h-11 border-b-2 px-4 text-sm font-medium ${activeSection === section.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </nav>

      {activeSection === "profile" && (
        <section
          aria-labelledby="profile-heading"
          className="max-w-3xl rounded-2xl border border-border bg-card p-5 sm:p-7"
        >
          <h2 id="profile-heading" className="text-lg font-semibold">
            Profile
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the details used for your orders and account.
          </p>
          <form
            onSubmit={submitProfile}
            className="mt-5 grid gap-4 sm:grid-cols-2"
          >
            <label className="block text-sm font-medium">
              Full name
              <input
                required
                name="fullName"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3"
              />
            </label>
            <label className="block text-sm font-medium">
              Email
              <input
                type="email"
                name="email"
                value={profileEmail}
                onChange={(event) => setProfileEmail(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3"
              />
            </label>
            <label className="block text-sm font-medium sm:col-span-2">
              Phone number
              <input
                value={phone}
                readOnly
                aria-describedby="phone-hint"
                className="mt-1 min-h-11 w-full cursor-not-allowed rounded-md border border-border bg-muted px-3 text-muted-foreground"
              />
              <span
                id="phone-hint"
                className="mt-1 block text-xs text-muted-foreground"
              >
                Phone changes require OTP and are not available in this demo.
              </span>
            </label>
            {profileError && (
              <p
                role="alert"
                className="text-sm text-destructive sm:col-span-2"
              >
                {profileError}
              </p>
            )}
            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={!isProfileDirty || profileMutation.isPending}
              >
                {profileMutation.isPending ? "Saving�" : "Save profile"}
              </Button>
            </div>
          </form>
        </section>
      )}

      {activeSection === "addresses" && (
        <section aria-labelledby="addresses-heading" className="space-y-4">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="addresses-heading" className="text-lg font-semibold">
                Saved addresses
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose where your orders should be delivered.
              </p>
            </div>
            <Button
              onClick={() => {
                setEditing(null);
                setAddressError("");
                setAddressDialogOpen(true);
              }}
            >
              Add address
            </Button>
          </header>
          {addresses.isPending ? (
            <div
              role="status"
              aria-label="Loading addresses"
              className="space-y-3"
            >
              {[1, 2].map((row) => (
                <div
                  key={row}
                  className="h-24 animate-pulse rounded-xl bg-muted"
                />
              ))}
            </div>
          ) : addresses.isError ? (
            <ErrorState retry={() => void addresses.refetch()} />
          ) : addresses.data.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {addresses.data.map((address) => (
                <article
                  key={address.id}
                  className="rounded-xl border border-border bg-card p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{address.recipient}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {address.phone}
                      </p>
                    </div>
                    {address.isDefault && (
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm leading-6">{address.address}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      className="min-h-10 bg-transparent px-3 text-primary hover:bg-muted"
                      onClick={() => {
                        setEditing(address);
                        setAddressError("");
                        setAddressDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    {!address.isDefault && (
                      <Button
                        className="min-h-10 bg-transparent px-3 text-primary hover:bg-muted"
                        disabled={addressMutation.isPending}
                        onClick={() =>
                          addressMutation.mutate({
                            id: address.id,
                            method: "PUT",
                            body: { isDefault: true },
                          })
                        }
                      >
                        Set as default
                      </Button>
                    )}
                    <Button
                      className="min-h-10 bg-transparent px-3 text-destructive hover:bg-muted"
                      onClick={() => setDeleting(address)}
                    >
                      Delete
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <h3 className="font-semibold">No saved addresses</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a delivery address to speed up checkout.
              </p>
              <Button
                className="mt-4"
                onClick={() => setAddressDialogOpen(true)}
              >
                Add your first address
              </Button>
            </div>
          )}
          {addressError && (
            <p role="alert" className="text-sm text-destructive">
              {addressError}
            </p>
          )}
        </section>
      )}

      {activeSection === "security" && (
        <section
          aria-labelledby="security-heading"
          className="grid max-w-4xl gap-4 lg:grid-cols-2"
        >
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-7">
            <h2 id="security-heading" className="text-lg font-semibold">
              Change password
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use your current password to set a new one.
            </p>
            <form onSubmit={submitPassword} className="mt-5 space-y-4">
              <label className="block text-sm font-medium">
                Current password
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3"
                />
              </label>
              <label className="block text-sm font-medium">
                New password
                <input
                  required
                  minLength={8}
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3"
                />
                <PasswordStrength value={newPassword} />
              </label>
              <label className="block text-sm font-medium">
                Confirm new password
                <input
                  required
                  minLength={8}
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3"
                />
              </label>
              {passwordError && (
                <p role="alert" className="text-sm text-destructive">
                  {passwordError}
                </p>
              )}
              <Button type="submit" disabled={passwordMutation.isPending}>
                {passwordMutation.isPending ? "Updating�" : "Update password"}
              </Button>
            </form>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-7">
            <h2 className="text-lg font-semibold">Active sessions</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Device and session management is planned for P4.
            </p>
          </div>
        </section>
      )}

      {activeSection === "verification" && (
        <section
          aria-labelledby="verification-heading"
          className="max-w-3xl rounded-2xl border border-border bg-card p-5 sm:p-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-primary">
                Tier {user?.kycTier ?? 0}
              </p>
              <h2
                id="verification-heading"
                className="mt-1 text-lg font-semibold"
              >
                Verification and limits
              </h2>
            </div>
            {user?.kycTier ? (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                Verified
              </span>
            ) : (
              <span className="rounded-full bg-muted px-3 py-1 text-sm">
                Not verified
              </span>
            )}
          </div>
          {user?.kycTier ? (
            <>
              {wallet.isPending ? (
                <p role="status" className="mt-5 text-sm text-muted-foreground">
                  Loading wallet limits�
                </p>
              ) : wallet.data ? (
                <dl className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Maximum balance", wallet.data.limits.maxBalance],
                    ["Per transaction", wallet.data.limits.perTransaction],
                    ["Monthly outflow", wallet.data.limits.monthlyOutflow],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-muted/60 p-4">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-1 font-semibold">
                        <Money amount={value} />
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Wallet limits are unavailable right now.
                </p>
              )}
              <div className="mt-5 rounded-lg border border-border p-4">
                <h3 className="font-semibold">Tier 2</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Higher balance, transfer, and monthly outflow limits will be
                  available when advanced verification launches in P4.
                </p>
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-lg border border-border p-4">
              <h3 className="font-semibold">Tier 1 unlocks your wallet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Verify your identity to open a wallet and access the demo Tier 1
                balance and transfer limits.
              </p>
              <Link
                to="/me/verify"
                className="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Start verification
              </Link>
            </div>
          )}
        </section>
      )}

      <Dialog
        open={addressDialogOpen}
        onOpenChange={(open) => {
          setAddressDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogTitle>
            {editing ? "Edit address" : "Add delivery address"}
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Enter the recipient and delivery location details.
          </DialogDescription>
          <form
            key={editing?.id ?? "new-address"}
            onSubmit={submitAddress}
            className="mt-5 space-y-3"
          >
            {[
              ["recipient", "Recipient name", editing?.recipient ?? ""],
              ["phone", "Phone number", editing?.phone ?? phone],
              ["street", "Street address", editingAddress?.street ?? ""],
              ["ward", "Ward", editingAddress?.ward ?? ""],
              ["district", "District", editingAddress?.district ?? ""],
              ["province", "Province / city", editingAddress?.province ?? ""],
            ].map(([name, label, value]) => (
              <label key={name} className="block text-sm font-medium">
                {label}
                <input
                  required
                  name={name}
                  defaultValue={value}
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3"
                />
              </label>
            ))}
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="isDefault"
                defaultChecked={editing?.isDefault ?? !addresses.data?.length}
                className="h-4 w-4 accent-primary"
              />
              Set as default address
            </label>
            {addressError && (
              <p role="alert" className="text-sm text-destructive">
                {addressError}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button
                type="button"
                className="border border-border bg-transparent text-foreground"
                onClick={() => setAddressDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addressMutation.isPending}>
                {addressMutation.isPending
                  ? "Saving�"
                  : editing
                    ? "Save address"
                    : "Add address"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={`Delete ${deleting?.recipient ?? "address"}?`}
        description="This removes the saved delivery address. You can add it again later."
        onConfirm={() => {
          if (deleting)
            addressMutation.mutate({
              id: deleting.id,
              method: "DELETE",
              body: {},
            });
          setDeleting(null);
        }}
      />
    </div>
  );
}
